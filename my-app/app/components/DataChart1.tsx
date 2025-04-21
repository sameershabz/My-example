"use client";
import React, { useState, useEffect } from "react";
// import DatePicker from "react-datepicker";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "react-datepicker/dist/react-datepicker.css";
import { timeFormat } from "d3-time-format";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";

// 1. Define a type for each data item from the API
export interface ApiDataItem {
  deviceID: string;
  timestamp: string;  // ISO string from Lambda
  gnss: {
    quality_min: number;
    quality_avg: number;
    lat: number;
    lon: number;
    alt_m: number;
    speed_kmh: number;
    heading_deg: number;
  };
  voltage_v: number;
  current_a: { min: number; avg: number; max: number };
  temperature_c: number;
  signal_strength_dbm: number;
  speed: number | null;
  accel: { x: number; y: number; z: number };
  power_kw: number;
}

interface MappedDataItem extends ApiDataItem {
  date: Date;
  dateStr: string;
  quality_min: number;
  quality_avg: number;
  lat: number;
  lon: number;
  alt_m: number;
  speed_kmh: number;
  heading_deg: number;
  voltage_v: number;
  min: number;
  avg: number;
  max: number;
  temperature_c: number;
  signal_strength_dbm: number;
  speed: number;
  accel_x: number;
  accel_y: number;
  accel_z: number;
  power_kw: number;
}


interface DataChart1Props {
  data: ApiDataItem[];
  chartFields: string[];
}

// 3. Type for timeRange
type TimeRange = "24hr" | "7d" | "1m" | "1y" | "all" | "custom";

const timeRanges: { label: string; value: TimeRange }[] = [
    { label: "24hr", value: "24hr" },
    { label: "7 Day", value: "7d" },
    { label: "1 Month", value: "1m" },
    { label: "1 Year", value: "1y" },
    { label: "All Time", value: "all" },
    { label: "Custom", value: "custom" }
  ];
// 4. Define your component
export default function DataChart1({ data, chartFields }: DataChart1Props) {
  const [mappedData, setMappedData] = useState<MappedDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  

  // Raw API data
  // const [data, setData] = useState<ApiDataItem[]>([]);
  // Data mapped into chart format

  // UI controls
  const allFields = [
    "quality_min","quality_avg","lat","lon","alt_m","speed_kmh","heading_deg",
    "voltage_v","min","avg","max","temperature_c","signal_strength_dbm",
    "speed","accel_x","accel_y","accel_z","power_kw"
  ];
  
  
  const [selectedDevices, setSelectedDevices] = useState<string[]>(["all"]);
  const [timeRange, setTimeRange] = useState<TimeRange>("1m");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  

  useEffect(() => {
    if (!data) return;
    const fmt = timeFormat("%Y-%m-%d %H:%M");
    const m = data.map((item) => {
      const dateObj = new Date(item.timestamp);
      return {
        ...item,
        date: dateObj,
        dateStr: fmt(dateObj),

        quality_min: item.gnss.quality_min,
        quality_avg: item.gnss.quality_avg,
        lat:           item.gnss.lat,
        lon:           item.gnss.lon,
        alt_m:         item.gnss.alt_m,
        speed_kmh:     item.gnss.speed_kmh,
        heading_deg:   item.gnss.heading_deg,

        voltage_v:     item.voltage_v,

        min:           item.current_a.min,
        avg:           item.current_a.avg,
        max:           item.current_a.max,

        temperature_c:       item.temperature_c,
        signal_strength_dbm: item.signal_strength_dbm,
        speed:               item.speed ?? 0,

        accel_x: item.accel.x,
        accel_y: item.accel.y,
        accel_z: item.accel.z,

        power_kw: item.power_kw
      } as MappedDataItem;
    });
    setMappedData(m);
    setLoading(false);
  }, [data]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: "2rem" }}>Loading chart data…</div>;
  }
  if (!mappedData.length) {
    return <div style={{ textAlign: "center", padding: "2rem" }}>No data available</div>;
  }


  // Build a unique device list
  const uniqueDevices = ["all", ...new Set(mappedData.map((d) => d.deviceID))];

  // if (loading || !mappedData.length) {
  //   return <div style={{ textAlign: "center", padding: "2rem" }}>Loading chart data…</div>;
  // }

  
  
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={mappedData}
        margin={{ left: 0, right: 0, top: 20, bottom: 130 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="dateStr"
          angle={-90}
          textAnchor="end"
        />
        <YAxis />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "none",
            borderRadius: "0.5rem",
            color: "white"
          }}
          itemStyle={{ color: "white" }}
        />
        {chartFields.map((field) => (
          <Line
            key={field}
            type="monotone"
            dataKey={field}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
