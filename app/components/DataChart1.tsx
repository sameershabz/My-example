// components/DataChart1.tsx
"use client";
import React, { useState, useEffect } from "react";
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
import { Download, Eye, EyeOff, Settings } from "lucide-react";
import { dataToCSV } from "@/lib/data-processor";
import type { RawDataItem } from "@/lib/data-processor";

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
  signal_strength_dbm?: number;
  speed?: number;
  accel?: { x: number; y: number; z: number };
  power_kw?: number;
  [key: string]: any;
}

interface DataChart1Props {
  data: ApiDataItem[];
  chartFields: string[];
  loading: boolean;
  rawData?: RawDataItem[]; // Raw data for CSV export
}

export default function DataChart1({ data, chartFields, loading, rawData }: DataChart1Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<any[]>([]);
  const [seriesKeys, setSeriesKeys] = useState<string[]>([]);
  const [showLegend, setShowLegend] = useState(true);

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
              domain={["auto", "auto"]}
              scale="time"
              height={60}
              tickFormatter={(v: number) => timeFormat("%Y-%m-%d %H:%M")(new Date(v))}
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
              labelFormatter={(label: number) => timeFormat("%Y-%m-%d %H:%M:%S.%L")(new Date(label))}
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
                name={key}
                stroke={getColor(i)}
                strokeWidth={2}
                connectNulls
                dot={{ r: 3, fill: getColor(i), strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
                hide={hidden.has(key)}
              />
            ))}
            <Brush dataKey="ts" height={24} travellerWidth={10} stroke="#94a3b8" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
