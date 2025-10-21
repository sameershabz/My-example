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
  type LegendPayload,
  type TooltipPropsValueType,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Download, Eye, EyeOff, Info } from "lucide-react";
import { dataToCSV } from "@/lib/data-processor";
import type { RawDataItem, CurrentStats, AccelVector, GnssData } from "@/lib/data-processor";

const DISPLAY_TIMEZONE = "UTC";

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

const BOOLEAN_FIELDS = new Set(["lte_ok", "gnss_ok"]);

const splitSeriesKey = (key: string) => {
  const separatorIndex = key.indexOf("-");
  if (separatorIndex === -1) {
    return { deviceId: key, field: "" };
  }
  return {
    deviceId: key.slice(0, separatorIndex),
    field: key.slice(separatorIndex + 1),
  };
};

const formatAxisLabelText = (fields: string[]): string => {
  if (!fields.length) return "";
  if (fields.length === 1) return fields[0];
  if (fields.length === 2) return `${fields[0]}, ${fields[1]}`;
  return `${fields[0]}, ${fields[1]} +${fields.length - 2}`;
};

const formatBooleanAxisTick = (value: number) => (value >= 0.5 ? "true" : "false");

interface DataChart1Props {
  data: RawDataItem[];
  chartFields: string[];
  loading: boolean;
  rawData?: RawDataItem[];
  autoRange?: boolean;
  xDomain?: [number, number] | null;
  lastReceivedAtMs?: number | null;
}

type ChartRow = {
  ts: number;
  dateStr: string;
  [seriesKey: string]: number | string | null;
};

export default function DataChart1({
  data,
  chartFields,
  loading,
  rawData,
  autoRange = true,
  xDomain = null,
  lastReceivedAtMs = null,
}: DataChart1Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [seriesKeys, setSeriesKeys] = useState<string[]>([]);
  const [showLegend, setShowLegend] = useState(true);
  const [showDownloadInfo, setShowDownloadInfo] = useState(false);
  const [showDelay, setShowDelay] = useState(false);
  const [brushRange, setBrushRange] = useState<{ startTs: number; endTs: number } | null>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const syncMode = () => setIsDarkMode(root.classList.contains("dark"));
    const observer = new MutationObserver(syncMode);

    syncMode();
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const resolveFieldValue = (item: RawDataItem | undefined, field: string): number | null => {
    if (!item) return null;
    const direct = item[field as keyof RawDataItem];

    if (typeof direct === "number") {
      return Number.isFinite(direct) ? direct : null;
    }

    if (typeof direct === "boolean") {
      return direct ? 1 : 0;
    }

    if (field === "current_a") {
      if (typeof item.current_a === "number") return item.current_a;
      if (item.current_a && typeof item.current_a === "object") {
        const stats = item.current_a as CurrentStats;
        return stats.avg ?? stats.min ?? stats.max ?? null;
      }
    }

    if (["min", "avg", "max"].includes(field) && item.current_a && typeof item.current_a === "object") {
      const stats = item.current_a as CurrentStats;
      const stat = stats[field as keyof CurrentStats];
      return typeof stat === "number" ? stat : null;
    }

    if (item.gnss && field in item.gnss) {
      const gnssValue = item.gnss[field as keyof GnssData];
      return typeof gnssValue === "number" ? gnssValue : null;
    }

    if (item.accel && field.startsWith("accel_")) {
      const axis = field.split("_")[1] as keyof AccelVector;
      const accelValue = item.accel[axis];
      return typeof accelValue === "number" ? accelValue : null;
    }

    return null;
  };

  useEffect(() => {
    if (!data.length) {
      setRows([]);
      setSeriesKeys([]);
      setBrushRange(null);
      return;
    }

    const fmtTick = timeFormat("%Y-%m-%d %H:%M");
    const sorted = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const devices = Array.from(new Set(sorted.map((d) => d.deviceID)));

    const timestamps = Array.from(
      new Set(
        sorted
          .map((d) => ({ raw: d.timestamp, ms: new Date(d.timestamp).getTime() }))
          .filter((entry) => Number.isFinite(entry.ms))
          .map((entry) => entry.raw),
      ),
    );

    const builtRows: ChartRow[] = [];
    for (const ts of timestamps) {
      const tsMs = new Date(ts).getTime();
      if (!Number.isFinite(tsMs)) continue;
      const row: ChartRow = { ts: tsMs, dateStr: fmtTick(new Date(tsMs)) };
      devices.forEach((device) => {
        const item = sorted.find((d) => d.timestamp === ts && d.deviceID === device);
        chartFields.forEach((field) => {
          const key = `${device}-${field}`;
          row[key] = resolveFieldValue(item, field);
        });
      });
      builtRows.push(row);
    }

    setRows(builtRows);
    setSeriesKeys(devices.flatMap((device) => chartFields.map((field) => `${device}-${field}`)));
  }, [data, chartFields]);

  useEffect(() => {
    if (!rows.length) {
      setBrushRange(null);
      return;
    }
  }, [rows]);

  const handleLegendClick = (payload: LegendPayload) => {
    const key = String(payload.dataKey ?? payload.value ?? "");
    if (!key) return;
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const lastTransportDelaySeconds = useMemo(() => {
    if (!rows.length || !lastReceivedAtMs) return null;
    const lastTs = rows[rows.length - 1]?.ts;
    if (!lastTs) return null;
    return (lastReceivedAtMs - lastTs) / 1000;
  }, [rows, lastReceivedAtMs]);

  const lastUiDelayMs = useMemo(() => {
    if (!lastReceivedAtMs) return null;
    return Date.now() - lastReceivedAtMs;
  }, [lastReceivedAtMs]);

  const lastTotalDelaySeconds = useMemo(() => {
    if (!rows.length) return null;
    const lastTs = rows[rows.length - 1]?.ts;
    if (!lastTs) return null;
    return (Date.now() - lastTs) / 1000;
  }, [rows]);

  const activeBooleanFields = useMemo(
    () => Array.from(new Set(chartFields.filter((field) => BOOLEAN_FIELDS.has(field)))),
    [chartFields],
  );

  const primaryFields = useMemo(
    () => Array.from(new Set(chartFields.filter((field) => !BOOLEAN_FIELDS.has(field)))),
    [chartFields],
  );

  const booleanSeriesKeys = useMemo(
    () => seriesKeys.filter((key) => BOOLEAN_FIELDS.has(splitSeriesKey(key).field)),
    [seriesKeys],
  );

  const showBooleanAxis = booleanSeriesKeys.length > 0;

  const primaryAxisLabel = showBooleanAxis ? formatAxisLabelText(primaryFields) : "";
  const booleanAxisLabel = showBooleanAxis ? formatAxisLabelText(activeBooleanFields) : "";

  const getColor = (i: number) => {
    const colors = [
      "#3b82f6",
      "#ef4444",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#06b6d4",
      "#84cc16",
      "#f97316",
      "#ec4899",
      "#6366f1",
    ];
    return colors[i % colors.length];
  };

  // No extra status overlay needed; axis ticks + legend suffice.

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

  const formatLegendName = (key: string) => {
    const { deviceId, field } = splitSeriesKey(key);
    const unit = FIELD_UNITS[field] || "";
    return `${deviceId}${field ? ` - ${field}` : ""}${unit ? ` (${unit})` : ""}`;
  };

  const brushSelection = useMemo(() => {
    if (!rows.length) return null;
    const maxIndex = rows.length - 1;

    if (!brushRange) {
      return {
        startIndex: 0,
        endIndex: maxIndex,
        isActive: false,
        startTs: rows[0]?.ts ?? null,
        endTs: rows[maxIndex]?.ts ?? null,
      };
    }

    const clampIndex = (targetTs: number, preferStart: boolean) => {
      if (!Number.isFinite(targetTs)) return preferStart ? 0 : maxIndex;
      if (preferStart) {
        for (let i = 0; i <= maxIndex; i += 1) {
          if (rows[i].ts >= targetTs) return i;
        }
        return maxIndex;
      }
      for (let i = maxIndex; i >= 0; i -= 1) {
        if (rows[i].ts <= targetTs) return i;
      }
      return 0;
    };

    const startIndex = clampIndex(brushRange.startTs, true);
    const endIndex = clampIndex(brushRange.endTs, false);
    const normalizedStart = Math.max(0, Math.min(maxIndex, startIndex));
    const normalizedEnd = Math.max(normalizedStart, Math.min(maxIndex, endIndex));
    const isActive = !(normalizedStart === 0 && normalizedEnd === maxIndex);
    const startTs = rows[normalizedStart]?.ts ?? null;
    const endTs = rows[normalizedEnd]?.ts ?? null;

    return {
      startIndex: normalizedStart,
      endIndex: normalizedEnd,
      isActive,
      startTs,
      endTs,
    };
  }, [rows, brushRange]);

  const brushDomain = useMemo(() => {
    if (!brushSelection || !brushSelection.isActive) return null;
    const { startTs, endTs } = brushSelection;
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || startTs === endTs) return null;
    return [startTs, endTs] as [number, number];
  }, [brushSelection]);

  const visibleCount = useMemo(() => {
    if (!rows.length) return 0;
    if (!brushSelection || !brushSelection.isActive) return rows.length;
    return brushSelection.endIndex - brushSelection.startIndex + 1;
  }, [rows, brushSelection]);

  const handleBrushChange = (
    range: { startIndex?: number; endIndex?: number } | { start?: number; end?: number } | null,
  ) => {
    if (!rows.length) {
      setBrushRange(null);
      return;
    }

    if (!range) {
      setBrushRange(null);
      return;
    }

    const startRaw = "startIndex" in range ? range.startIndex : range.start;
    const endRaw = "endIndex" in range ? range.endIndex : range.end;
    if (typeof startRaw !== "number" || typeof endRaw !== "number") {
      setBrushRange(null);
      return;
    }

    const maxIndex = rows.length - 1;
    const normalizedStart = Math.max(0, Math.min(maxIndex, Math.min(startRaw, endRaw)));
    const normalizedEnd = Math.max(normalizedStart, Math.min(maxIndex, Math.max(startRaw, endRaw)));

    if (normalizedStart === 0 && normalizedEnd >= maxIndex) {
      setBrushRange(null);
      return;
    }

    setBrushRange((prev) => {
      const startTs = rows[normalizedStart]?.ts ?? rows[0]?.ts ?? Date.now();
      const endTs = rows[normalizedEnd]?.ts ?? rows[rows.length - 1]?.ts ?? startTs;
      if (prev && prev.startTs === startTs && prev.endTs === endTs) return prev;
      return { startTs, endTs };
    });
  };

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

  // Custom tooltip to ensure item values render as white text
  const CustomTooltip = ({ active, label, payload }: { active?: boolean; label?: number; payload?: any[] }) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div
        className="recharts-default-tooltip"
        style={{
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 8,
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
          padding: 10,
        }}
      >
        <p className="recharts-tooltip-label" style={{ color: "#94a3b8", margin: 0 }}>
          {typeof label === "number"
            ? new Date(label).toLocaleString(undefined, {
                timeZone: DISPLAY_TIMEZONE,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })
            : label}
        </p>
        <ul className="recharts-tooltip-item-list" style={{ listStyle: "none", padding: 0, margin: "6px 0 0 0" }}>
          {payload.map((entry, idx) => (
            <li key={idx} className="recharts-tooltip-item" style={{ color: "#f8fafc", margin: 0 }}>
              <span className="recharts-tooltip-item-name" style={{ color: "#cbd5e1" }}>{entry.name}</span>
              <span className="recharts-tooltip-item-separator" style={{ color: "#cbd5e1", margin: "0 6px" }}>
                :
              </span>
              <span className="recharts-tooltip-item-value" style={{ color: "#ffffff" }}>{entry.value}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setShowLegend(!showLegend)} className="h-8 px-3">
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
                  <p className="font-normal mb-2">CSV Download Information:</p>
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
          {visibleCount} data points • {seriesKeys.length} series
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <div className="relative">
          <ResponsiveContainer width="100%" height={660}>
            <LineChart
              data={rows}
              margin={{
                top: 20,
                right: showBooleanAxis ? 80 : 30,
                bottom: 120,
                left: showBooleanAxis && primaryAxisLabel ? 40 : 20,
              }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={brushDomain ?? (autoRange || !xDomain ? ["auto", "auto"] : [xDomain[0], xDomain[1]])}
                  scale="time"
                  height={200}
                  angle={-90}
                  textAnchor="end"
                  tickMargin={12}
                  tickFormatter={(v: number) => new Date(v).toLocaleString(undefined, {
                    timeZone: DISPLAY_TIMEZONE,
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                  tick={{ fontsize: 22, fontWeight: "bold", fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  yAxisId="primary"
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 20, fontWeight: "bold" , fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={{ stroke: "#e2e8f0" }}
                  label={showBooleanAxis && primaryAxisLabel
                    ? {
                        value: primaryAxisLabel,
                        angle: -90,
                        position: "insideLeft",
                        offset: -5,
                        style: { fill: "#94a3b8", fontSize: 20, fontWeight: "bold"  },
                      }
                    : undefined}
                />
                {showBooleanAxis && (
                  <YAxis
                    yAxisId="bool"
                    domain={[-0.1, 1.1]}
                    ticks={[0, 1]}
                    orientation="right"
                    tickFormatter={formatBooleanAxisTick}
                    tick={{ fontSize: 20, fontWeight: "bold" , fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={{ stroke: "#e2e8f0" }}
                    label={booleanAxisLabel
                      ? {
                          value: booleanAxisLabel,
                          angle: 90,
                          position: "insideRight",
                          offset: -5,
                          style: { fill: "#94a3b8", fontSize: 20, fontWeight: "bold"  },
                        }
                      : undefined}
                  />
                )}
                <Tooltip content={<CustomTooltip />} />
                {showLegend && (
                  <Legend
                    onClick={handleLegendClick}
                    layout="horizontal"
                    verticalAlign="top"
                    align="center"
                    wrapperStyle={{ paddingBottom: "20px" }}
                  />
                )}
                {seriesKeys.map((key, i) => {
                  const { field } = splitSeriesKey(key);
                  const isBooleanSeries = BOOLEAN_FIELDS.has(field);
                  const dotStrokeColor = isDarkMode ? "#fff" : "#000";
                  return (
                    <Line
                      key={key}
                      dataKey={key}
                      name={formatLegendName(key)}
                      stroke={getColor(i)}
                      strokeWidth={2}
                      connectNulls
                      dot={{ r: 3, fill: getColor(i), strokeWidth: 1, stroke: dotStrokeColor }}
                      activeDot={{ r: 6, stroke: dotStrokeColor, strokeWidth: 2 }}
                      hide={hidden.has(key)}
                      yAxisId={isBooleanSeries ? "bool" : "primary"}
                      type={isBooleanSeries ? "stepAfter" : "linear"}
                    />
                  );
                })}
              <Brush
                dataKey="ts"
                data={rows}
                height={36}
                travellerWidth={24}
                fill="#00000000"
                stroke="#333"
                startIndex={brushSelection ? brushSelection.startIndex : 0}
                endIndex={brushSelection ? brushSelection.endIndex : Math.max(rows.length - 1, 0)}
                onChange={handleBrushChange}
                tickFormatter={() => ""}
              />
            </LineChart>
          </ResponsiveContainer>
          {/* Removed external boolean status legend overlay */}
        </div>
      </div>

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
                Total:
                {lastTotalDelaySeconds < 10
                  ? `${lastTotalDelaySeconds.toFixed(1)} s`
                  : `${Math.round(lastTotalDelaySeconds)} s`}
              </>
            )}
            {lastTotalDelaySeconds != null &&
              (lastTransportDelaySeconds != null || lastUiDelayMs != null) &&
              " • "}
            {lastTransportDelaySeconds != null && (
              <>
                Net:
                {lastTransportDelaySeconds < 10
                  ? `${lastTransportDelaySeconds.toFixed(1)} s`
                  : `${Math.round(lastTransportDelaySeconds)} s`}
              </>
            )}
            {lastTransportDelaySeconds != null && lastUiDelayMs != null && " • "}
            {lastUiDelayMs != null && (
              <>
                UI:
                {lastUiDelayMs < 1000
                  ? `${Math.round(lastUiDelayMs)} ms`
                  : `${
                      lastUiDelayMs / 1000 < 10
                        ? (lastUiDelayMs / 1000).toFixed(1)
                        : Math.round(lastUiDelayMs / 1000)
                    } s`}
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
