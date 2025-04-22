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
  [key: string]: any;
}
interface DataChart1Props {
  data: ApiDataItem[];
  chartFields: string[];
  loading: boolean;
}

export default function DataChart1({ data, chartFields, loading }: DataChart1Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const handleLegendClick = (e: any) => {
    const key = e.dataKey || e.value;
    const s = new Set(hidden);
    hidden.has(key) ? s.delete(key) : s.add(key);
    setHidden(s);
  };

  // build sorted rows and series keys
  const [rows, setRows] = useState<any[]>([]);
  const [seriesKeys, setSeriesKeys] = useState<string[]>([]);
  useEffect(() => {
    if (!data.length) { setRows([]); setSeriesKeys([]); return; }
    const fmt = timeFormat("%Y-%m-%d %H:%M");
    const sorted = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const devices = Array.from(new Set(sorted.map(d => d.deviceID)));
    const keys = devices.flatMap(dev => chartFields.map(f => `${dev}-${f}`));
    const out = sorted.map(item => {
      const r: any = { dateStr: fmt(new Date(item.timestamp)) };
      devices.forEach(dev => {
        chartFields.forEach(f => {
          const key = `${dev}-${f}`;
          r[key] = item.deviceID === dev
            ? (item as any)[f] ?? (item.gnss?.[f] ?? null)
            : null;
        });
      });
      return r;
    });
    setRows(out);
    setSeriesKeys(keys);
  }, [data, chartFields]);

  if (loading) return <div style={{ textAlign: "center", padding: "2rem" }}>Loading…</div>;
  if (!rows.length) return <div style={{ textAlign: "center", padding: "2rem" }}>No data</div>;

  const total = seriesKeys.length;
  const getColor = (i: number) => `hsl(${Math.round((i/total)*360)},70%,50%)`;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={rows} margin={{ top:20, right:20, bottom:100, left:0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="dateStr" angle={-90} textAnchor="end" />
        <YAxis />
        <Tooltip 
          contentStyle={{ backgroundColor:"#1f2937", border:"none", borderRadius:4 }}
          itemStyle={{ color:"#fff" }}
        />
        <Legend onClick={handleLegendClick} />



                  {seriesKeys.map((key, i) => (
                      <Line
                        key={key}
                        dataKey={key}
                        name={key}
                        stroke={getColor(i)}
                        dot={{ r: 4 }}            // <-- show points with radius 4
                        activeDot={{ r: 6 }}      // <-- larger on hover
                        hide={hidden.has(key)}
                      />
                    ))}

      </LineChart>
    </ResponsiveContainer>
  );
}
