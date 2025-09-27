// components/DataChart1.tsx
"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { timeFormat } from "d3-time-format";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  Tooltip,
  Brush,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Download, Eye, EyeOff, Settings, Info } from "lucide-react";
import { dataToCSV } from "@/lib/data-processor";
import type { RawDataItem } from "@/lib/data-processor";

// Force display timezone to UTC/GMT
const DISPLAY_TIMEZONE = "UTC";

// Field units mapping
const FIELD_UNITS: Record<string, string> = {
  voltage_v: "V",
  current_a: "A",
  temperature_c: "°C",
  speed_kmh: "km/h",
  power_kw: "kW",
  lat: "°",
  lon: "°",
  alt_m: "m",
  heading_deg: "°",
  quality_min: "",
  quality_avg: "",
  accel_x: "g",
  accel_y: "g",
  accel_z: "g",
  lte_ok: "",
  gnss_ok: "",
  min: "A",
  avg: "A",
  max: "A",
};

export interface ApiDataItem {
  deviceID: string;
  timestamp: string;
  gnss?: {
    quality_min: number;
    quality_avg: number;
    lat: number;
    lon: number;
    alt_m: number;
    speed_kmh: number;
    heading_deg: number;
  };
  voltage_v?: number;
  current_a?: number | { min: number; avg: number; max: number };
  temperature_c?: number;
  accel?: { x: number; y: number; z: number };
  power_kw?: number;
  [key: string]: any;
}

interface DataChart1Props {
  data: ApiDataItem[];
  chartFields: string[];
  loading: boolean;
  rawData?: RawDataItem[]; // Raw data for CSV export
  autoRange?: boolean; // controls X-axis autorange
  xDomain?: [number, number] | null; // explicit domain when autoRange is false
  lastReceivedAtMs?: number | null; // when the latest batch arrived on frontend
}

const BrushLine = (props: any) => {
  const { x, y, width, height } = props;
  const cy = y + height / 2;
  return (
    <g>
      <line x1={x} y1={cy} x2={x + width} y2={cy} stroke="#3b82f6" strokeWidth={3}/>
    </g>
  );
};

const CustomBrush = (props: any) => {
  const { x, y, width, height, onDragStartLeft, onDragStartRight } = props;

  const cy = y + height / 2;

  return (
    <g>
      {/* Connecting line between handles */}
      <line
        x1={x}
        y1={cy}
        x2={x + width}
        y2={cy}
        stroke="#3b82f6"
        strokeWidth={3}
        strokeDasharray="4 2" // optional, makes dashed
      />
      {/* Left handle as larger circle */}
      <circle
        cx={x}
        cy={cy}
        r={14} // bigger than before
        fill="#3b82f6"
        stroke="#fff"
        strokeWidth={3}
        cursor="ew-resize"
        onMouseDown={onDragStartLeft}
      />
      {/* Right handle as larger circle */}
      <circle
        cx={x + width}
        cy={cy}
        r={14}
        fill="#3b82f6"
        stroke="#fff"
        strokeWidth={3}
        cursor="ew-resize"
        onMouseDown={onDragStartRight}
      />
    </g>
  );
};

export default function DataChart1({ data, chartFields, loading, rawData, autoRange = true, xDomain = null, lastReceivedAtMs = null }: DataChart1Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<any[]>([]);
  const [seriesKeys, setSeriesKeys] = useState<string[]>([]);
  const [showLegend, setShowLegend] = useState(true);
  const [showDownloadInfo, setShowDownloadInfo] = useState(false);
  const [brushRange, setBrushRange] = useState<[number, number] | null>(null);
  const [showDelay, setShowDelay] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close info tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
        setShowDownloadInfo(false);
      }
    };

    if (showDownloadInfo) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDownloadInfo]);

  useEffect(() => {
    if (!data.length) {
      setRows([]);
      setSeriesKeys([]);
      return;
    }

    const fmtTick = timeFormat("%Y-%m-%d %H:%M");
    const sorted = [...data].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const devices = Array.from(new Set(sorted.map((d) => d.deviceID)));
    const timestamps = Array.from(new Set(sorted.map((d) => d.timestamp)));

    // build rows per timestamp
    const out = timestamps.map((ts) => {
      const tsMs = new Date(ts).getTime();
      const r: any = { ts: tsMs, dateStr: fmtTick(new Date(ts)) };
      devices.forEach((dev) => {
        const item = sorted.find((d) => d.timestamp === ts && d.deviceID === dev);
        chartFields.forEach((f) => {
          const key = `${dev}-${f}`;
          let val: number | null = null;
          if (item) {
            if (f in item) {
              val = (item as any)[f];
            } else if (item.gnss && f in item.gnss) {
              val = (item.gnss as any)[f];
            } else if (item.current_a && ["min", "avg", "max"].includes(f)) {
              val = (item.current_a as any)[f];
            } else if (item.accel && f.startsWith("accel_")) {
              const axis = f.split("_")[1];
              val = (item.accel as any)[axis];
            }
          }
          r[key] = val;
        });
      });
      return r;
    });

    const keys = devices.flatMap((dev) => chartFields.map((f) => `${dev}-${f}`));
    setRows(out);
    setSeriesKeys(keys);
  }, [data, chartFields]);

  const handleLegendClick = (e: any) => {
    const key = e.dataKey || e.value;
    const s = new Set(hidden);
    hidden.has(key) ? s.delete(key) : s.add(key);
    setHidden(s);
  };

  // Latest transport delay (receive time - last sample ts) in seconds
  const lastTransportDelaySeconds = useMemo(() => {
    if (!rows.length) return null;
    if (!lastReceivedAtMs) return null;
    const lastTs = rows[rows.length - 1]?.ts;
    if (!lastTs) return null;
    return (lastReceivedAtMs - lastTs) / 1000;
  }, [rows, lastReceivedAtMs, showDelay]);

  // UI delay (render time - receive time) in milliseconds
  const lastUiDelayMs = useMemo(() => {
    if (!lastReceivedAtMs) return null;
    return Date.now() - lastReceivedAtMs;
  }, [lastReceivedAtMs, showDelay]);

  // Total end-to-end delay (render time - last sample ts) in seconds
  const lastTotalDelaySeconds = useMemo(() => {
    if (!rows.length) return null;
    const lastTs = rows[rows.length - 1]?.ts;
    if (!lastTs) return null;
    return (Date.now() - lastTs) / 1000;
  }, [rows, showDelay]);

  const handleDownloadCSV = () => {
    if (!rawData || rawData.length === 0) {
      alert("No raw data available for download");
      return;
    }

    const csv = dataToCSV(rawData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `telematics-data-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getColor = (i: number) => {
    const colors = [
      "#3b82f6", // blue
      "#ef4444", // red
      "#10b981", // green
      "#f59e0b", // amber
      "#8b5cf6", // violet
      "#06b6d4", // cyan
      "#84cc16", // lime
      "#f97316", // orange
      "#ec4899", // pink
      "#6366f1", // indigo
    ];
    return colors[i % colors.length];
  };

  const formatLegendName = (key: string) => {
    const [device, field] = key.split('-');
    const unit = FIELD_UNITS[field] || '';
    return `${device} - ${field}${unit ? ` (${unit})` : ''}`;
  };

  const handleBrushChange = (brushData: any) => {
    if (brushData && brushData.startIndex !== undefined && brushData.endIndex !== undefined) {
      const startTime = rows[brushData.startIndex]?.ts;
      const endTime = rows[brushData.endIndex]?.ts;
      if (startTime && endTime) {
        setBrushRange([startTime, endTime]);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading chart data...</p>
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="flex items-center justify-center h-96 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">No data available</p>
          <p className="text-slate-500 dark:text-slate-500 text-sm mt-1">Select a time range and data fields to view charts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chart Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLegend(!showLegend)}
            className="h-8 px-3"
          >
            {showLegend ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="ml-2">Legend</span>
          </Button>
          <div className="relative" ref={infoRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCSV}
              disabled={!rawData || rawData.length === 0}
              className="h-8 px-3"
            >
              <Download className="h-4 w-4" />
              <span className="ml-2">Download CSV</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDownloadInfo(!showDownloadInfo)}
              className="h-8 w-8 p-0 ml-1"
            >
              <Info className="h-4 w-4" />
            </Button>
            {showDownloadInfo && (
              <div className="absolute top-10 left-0 z-50 w-80 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  <p className="font-medium mb-2">CSV Download Information:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Downloads data for the current time range</li>
                    <li>• Includes all devices and telemetry fields</li>
                    <li>• Data is not filtered by current chart selections</li>
                    <li>• Contains raw data points (not downsampled)</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {rows.length} data points • {seriesKeys.length} series
        </div>
      </div>

      {/* Chart Container */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={rows} margin={{ top: 20, right: 30, bottom: 80, left: 20 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e2e8f0" 
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="ts"
              type="number"
              domain={autoRange || !xDomain ? ["auto", "auto"] : [xDomain[0], xDomain[1]]}
              scale="time"
              height={60}
              tickFormatter={(v: number) => new Date(v).toLocaleString(undefined, {
                timeZone: DISPLAY_TIMEZONE,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false,
              })}
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis 
              domain={["auto", "auto"]}
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={{ stroke: '#e2e8f0' }}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: "#1e293b", 
                border: "1px solid #334155", 
                borderRadius: "8px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)"
              }}
              itemStyle={{ color: "#f1f5f9" }}
              labelStyle={{ color: "#94a3b8" }}
              labelFormatter={(label: number) => new Date(label).toLocaleString(undefined, {
                timeZone: DISPLAY_TIMEZONE,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false,
              })}
            />
            {showLegend && (
              <Legend
                onClick={handleLegendClick}
                layout="horizontal"
                verticalAlign="top"
                align="center"
                wrapperStyle={{ paddingBottom: "20px" }}
              />
            )}
            {seriesKeys.map((key, i) => (
              <Line
                key={key}
                dataKey={key}
                name={formatLegendName(key)}
                stroke={getColor(i)}
                strokeWidth={2}
                connectNulls
                dot={{ r: 3, fill: getColor(i), strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
                hide={hidden.has(key)}
              />
            ))}
              <Brush
                dataKey="ts"
                height={36}
                travellerWidth={28}            // larger hit target
                fill="#00000000"             // hide grey bar
                stroke="#333"
                onChange={handleBrushChange}
                // content={<BrushLine />}        // just draws the line between handles
                tickFormatter={() => ""}
              />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Delay viewer under the chart */}
      <div className="flex justify-center items-center space-x-3">
        <Button
          variant={showDelay ? "default" : "outline"}
          size="sm"
          onClick={() => setShowDelay((v) => !v)}
          className="h-8 px-3"
        >
          {showDelay ? "Hide Delay" : "View Delay"}
        </Button>
        {showDelay && (
          <span className="text-sm text-slate-700 dark:text-slate-200 tabular-nums">
            {lastTotalDelaySeconds != null && (
              <>
                Total: {lastTotalDelaySeconds < 10
                  ? `${lastTotalDelaySeconds.toFixed(1)} s`
                  : `${Math.round(lastTotalDelaySeconds)} s`}
              </>
            )}
            {lastTotalDelaySeconds != null && (lastTransportDelaySeconds != null || lastUiDelayMs != null) && ' • '}
            {lastTransportDelaySeconds != null && (
              <>
                Net: {lastTransportDelaySeconds < 10
                  ? `${lastTransportDelaySeconds.toFixed(1)} s`
                  : `${Math.round(lastTransportDelaySeconds)} s`}
              </>
            )}
            {lastTransportDelaySeconds != null && lastUiDelayMs != null && ' • '}
            {lastUiDelayMs != null && (
              <>
                UI: {lastUiDelayMs < 1000
                  ? `${Math.round(lastUiDelayMs)} ms`
                  : `${(lastUiDelayMs / 1000 < 10 ? (lastUiDelayMs / 1000).toFixed(1) : Math.round(lastUiDelayMs / 1000))} s`}
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
