"use client";
import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
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
interface ApiDataItem {
  DeviceId: string;
  timestamp: string;    // from the API
  data1?: number | string;
  data2?: number | string;
  data3?: number | string;
}

// 2. Define an extended type for our mapped data
interface MappedDataItem extends ApiDataItem {
  date: Date;          // actual Date object
  dateStr: string;     // formatted date for the X-axis
  data1: number;       // forced numeric
  data2: number;
  data3: number;
}


interface DataChart1Props { // comment no purpose 2
  token: string;
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
function DataChart1({ token }: DataChart1Props) {

  // Raw API data
  const [data, setData] = useState<ApiDataItem[]>([]);
  // Data mapped into chart format
  const [mappedData, setMappedData] = useState<MappedDataItem[]>([]);
  // Filtered data after applying UI controls
  const [filteredData, setFilteredData] = useState<MappedDataItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // UI controls
  const [chartFields, setChartFields] = useState<string[]>(["data1"]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>(["all"]);
  const [timeRange, setTimeRange] = useState<TimeRange>("1m");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // API endpoint
  const API_QUERY_URL = "https://aficym0116.execute-api.us-east-1.amazonaws.com/QueryAPI";

  // Fetch API data on mount
  useEffect(() => {
    const url = "https://aficym0116.execute-api.us-east-1.amazonaws.com/QueryAPI";
    fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    })
    .then((res) => res.json())
    .then((json: ApiDataItem[]) => {
      setData(json);
      setLoading(false);
    })
    .catch((err) => {
      console.error("Error fetching API data:", err);
      setError("Failed to fetch data");
      setLoading(false);
    });
  }, [token]);
  

  // Map API data to include a "date" property and a formatted date string
  useEffect(() => {
    if (!data.length) return;
    const formatDate = timeFormat("%Y-%m-%d %H:%M"); // e.g., "2024-04-03 13:45"

    const mapped = data
      .map((item) => {
        const timestampNum = Number(item.timestamp) * 1000;
        const dateObj = new Date(timestampNum);
        if (!timestampNum || isNaN(dateObj.getTime())) return null; // skip invalid items

        return {
          ...item,
          date: dateObj,
          dateStr: formatDate(dateObj),
          data1: isNaN(Number(item.data1)) ? 0 : Number(item.data1),
          data2: isNaN(Number(item.data2)) ? 0 : Number(item.data2),
          data3: isNaN(Number(item.data3)) ? 0 : Number(item.data3)
        } as MappedDataItem;
      })
      .filter((d): d is MappedDataItem => d !== null); 
      // the ": d is MappedDataItem" is a TypeScript type guard

    setMappedData(mapped);
  }, [data]);

  // If timeRange is not custom, auto-set startDate and endDate
  useEffect(() => {
    if (timeRange !== "custom") {
      const now = new Date();
      let newStart: Date | null = null;
      switch (timeRange) {
        case "24hr":
          newStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          newStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "1m":
          newStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case "1y":
          newStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        case "all":
        default:
          newStart = null;
      }
      setStartDate(newStart);
      setEndDate(now);
    }
  }, [timeRange]);

  // Filter mappedData by selected devices and date range
  useEffect(() => {
    if (!mappedData.length) return;
    let filtered = mappedData;

    if (!selectedDevices.includes("all")) {
      filtered = filtered.filter((d) => selectedDevices.includes(d.DeviceId));
    }

    if (startDate) {
      filtered = filtered.filter((d) => d.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((d) => d.date <= endDate);
    }

    setFilteredData(filtered);
  }, [mappedData, selectedDevices, startDate, endDate]);

  // Build a unique device list
  const uniqueDevices = ["all", ...new Set(mappedData.map((d) => d.DeviceId))];

  if (loading) {
    return <div style={{ textAlign: "center", padding: "2rem" }}>Loading chart data…</div>;
  }
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
        View Data Stream
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
            {["data1", "data2", "data3"].map((field) => {
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
                contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "0.5rem", color: "white" }} // Tooltip background
                itemStyle={{ color: "white" }} // Text color of items
                />

              {chartFields.includes("data1") && (
                <Line type="monotone" dataKey="data1" stroke="#2563eb" dot={false} />
              )}
              {chartFields.includes("data2") && (
                <Line type="monotone" dataKey="data2" stroke="#10b981" dot={false} />
              )}
              {chartFields.includes("data3") && (
                <Line type="monotone" dataKey="data3" stroke="#f59e0b" dot={false} />
              )}
            </LineChart>
            </ResponsiveContainer>

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
