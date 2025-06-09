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
} from "recharts";

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
  current_a?: { min: number; avg: number; max: number };
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
}

export default function DataChart1({ data, chartFields, loading }: DataChart1Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<any[]>([]);
  const [seriesKeys, setSeriesKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!data.length) {
      setRows([]);
      setSeriesKeys([]);
      return;
    }

    const fmt = timeFormat("%Y-%m-%d %H:%M");
    const sorted = [...data].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const devices = Array.from(new Set(sorted.map((d) => d.deviceID)));
    const timestamps = Array.from(new Set(sorted.map((d) => d.timestamp)));

    // build rows per timestamp
    const out = timestamps.map((ts) => {
      const r: any = { dateStr: fmt(new Date(ts)) };
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

  if (loading) return <div style={{ textAlign: "center", padding: "2rem" }}>Loading…</div>;
  if (!rows.length) return <div style={{ textAlign: "center", padding: "2rem" }}>No data</div>;

  const total = seriesKeys.length;
  const getColor = (i: number) => `hsl(${Math.round((i / total) * 360)},70%,50%)`;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={rows} margin={{ top: 20, right: 20, bottom: 80, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="dateStr" angle={-90} textAnchor="end" height={80} />
        <YAxis domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: 4 }}
          itemStyle={{ color: "#fff" }}
        />
        <Legend
          onClick={handleLegendClick}
          layout="horizontal"
          verticalAlign="top"
          align="center"
        />
        {seriesKeys.map((key, i) => (
          <Line
            key={key}
            dataKey={key}
            name={key}
            stroke={getColor(i)}
            connectNulls
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
            hide={hidden.has(key)}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
