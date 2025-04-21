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
  
  // flattened numeric fields:
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
function DataChart1({ data }: DataChart1Props) {
  const [mappedData, setMappedData] = useState<MappedDataItem[]>([]);
  const [filteredData, setFilteredData] = useState<MappedDataItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Raw API data
  // const [data, setData] = useState<ApiDataItem[]>([]);
  // Data mapped into chart format

  // UI controls
  const allFields = [
    "quality_min","quality_avg","lat","lon","alt_m","speed_kmh","heading_deg",
    "voltage_v","min","avg","max","temperature_c","signal_strength_dbm",
    "speed","accel_x","accel_y","accel_z","power_kw"
  ];
  const [chartFields, setChartFields] = useState<string[]>(allFields);
  
  const [selectedDevices, setSelectedDevices] = useState<string[]>(["all"]);
  const [timeRange, setTimeRange] = useState<TimeRange>("1m");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  
  useEffect(() => {
    if (!data || data.length === 0) return;
  
    const formatDate = timeFormat("%Y-%m-%d %H:%M");
    const mapped = data.map((item) => {
      const dateObj = new Date(item.timestamp);
      return {
        ...item,
        date: dateObj,
        dateStr: formatDate(dateObj),
  
        // flatten everything into top‐level keys
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
  
        temperature_c:         item.temperature_c,
        signal_strength_dbm:   item.signal_strength_dbm,
        speed:                 item.speed ?? 0,
  
        accel_x:       item.accel.x,
        accel_y:       item.accel.y,
        accel_z:       item.accel.z,
  
        power_kw:      item.power_kw
      } as MappedDataItem;
    });
  
    setMappedData(mapped);
    setLoading(false);
  }, [data]);
  

  // Build a unique device list
  const uniqueDevices = ["all", ...new Set(mappedData.map((d) => d.deviceID))];

  // if (loading || !mappedData.length) {
  //   return <div style={{ textAlign: "center", padding: "2rem" }}>Loading chart data…</div>;
  // }

  
  
  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "red" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "0rem", boxSizing: "border-box" }}>
      <div style={{ maxWidth: "90rem", margin: "0 auto" }}>
      <h2 style={{ textAlign: "center", color: "white", fontSize: "2rem" }}>
      Telemetry Time Series
        </h2>
        {/* Controls Section */}
        <div style={{ margin: "1rem 0" }}>
          {/* Time Range Buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
            {timeRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value as TimeRange)}
                className={`px-4 py-2 text-sm sm:px-3 sm:py-1 sm:text-xs rounded border-none ${
                    timeRange === range.value ? "bg-blue-600 text-white" : "bg-gray-200 text-black"
                  }`}
                
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Date Pickers (only for Custom) */}
          {timeRange === "custom" && (
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label>Start Date:</label>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => {
                    setStartDate(date as Date);
                    setTimeRange("custom");
                  }}
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  placeholderText="Select start date"
                  showTimeSelect
                  dateFormat="Pp"
                />
              </div>
              <div>
                <label>End Date:</label>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => {
                    setEndDate(date as Date);
                    setTimeRange("custom");
                  }}
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  minDate={startDate || undefined}
                  placeholderText="Select end date"
                  showTimeSelect
                  dateFormat="Pp"
                />
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
              <button
                onClick={() => {
                    setStartDate(null);
                    setEndDate(null);
                    setTimeRange("all");
                }}
                className="px-4 py-2 text-sm sm:px-3 sm:py-1 sm:text-xs rounded bg-gray-600 text-white"
                >
                Clear Dates
                </button>

              </div>
            </div>
          )}

          {/* Device Filter */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
            {uniqueDevices.map((device) => {
              const isSelected = selectedDevices.includes(device);
              return (
                <button
                  key={device}
                  onClick={() => {
                    if (device === "all") {
                      setSelectedDevices(["all"]);
                    } else {
                      const newDevices = isSelected
                        ? selectedDevices.filter((d) => d !== device)
                        : [...selectedDevices.filter((d) => d !== "all"), device];
                      setSelectedDevices(newDevices.length === 0 ? ["all"] : newDevices);
                    }
                  }}
                  className={`px-4 py-2 text-sm sm:px-3 sm:py-1 sm:text-xs rounded border-none ${
                    isSelected ? "bg-blue-600 text-white" : "bg-gray-200 text-black"
                  }`}
                >
                  {device}
                </button>
              );
            })}
          </div>

          {/* Chart Field Selection */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
            {allFields.map((field) => {
              const isSelected = chartFields.includes(field);
              return (
                <button
                  key={field}
                  onClick={() => {
                    const newFields = isSelected
                      ? chartFields.filter((f) => f !== field)
                      : [...chartFields, field];
                    setChartFields(newFields);
                  }}
                  className={`px-4 py-2 text-sm sm:px-3 sm:py-1 sm:text-xs rounded border-none ${
                    isSelected ? "bg-blue-600 text-white" : "bg-gray-200 text-black"
                  }`}
                >
                  {field}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart Section */}
        <div style={{ margin: "2rem 0" }}>
        {loading ? (
  <div style={{ textAlign: "center", padding: "2rem" }}>
    Loading chart data…
  </div>
) : filteredData.length === 0 ? (
  <div>No data available</div>
  ) : (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={filteredData} margin={{ left: 0, right: 0, top: 20, bottom: 130 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="dateStr"
          domain={["auto", "auto"]}
          tickFormatter={(tick) => timeFormat("%Y-%m-%d %H:%M")(new Date(tick))}
          angle={-90}
          textAnchor="end"
        />
        <YAxis />
        <Tooltip
          labelFormatter={(value) => String(value)}
          contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "0.5rem", color: "white" }}
          itemStyle={{ color: "white" }}
        />
          {chartFields.map((field) => (
            <Line key={field} type="monotone" dataKey={field} stroke="#2563eb" dot={false} />
          ))} 
      </LineChart>
    </ResponsiveContainer>
    )}

                {/* Download CSV */}
                <div style={{ textAlign: "right", marginBottom: "2rem" }}>
                <button
                    onClick={() => {
                    if (!data.length) return;
                    const headers = Object.keys(data[0]);
                    const csvRows = [headers.join(",")];
                    data.forEach((item) => {
                        const values = headers.map((header) => (item as Record<string, any>)[header]);
                        csvRows.push(values.join(","));
                    });
                    const csvData = csvRows.join("\n");
                    const blob = new Blob([csvData], { type: "text/csv" });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.setAttribute("hidden", "");
                    a.setAttribute("href", url);
                    a.setAttribute("download", "esp_data.csv");
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    }}
                    className="px-4 py-2 text-sm sm:px-3 sm:py-1 sm:text-xs bg-blue-600 text-white rounded cursor-pointer"

                >
                    Download CSV
                </button>
                </div>

                </div>

      </div>
    </div>
  );
}

export default DataChart1;
