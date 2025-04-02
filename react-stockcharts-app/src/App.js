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

// API endpoint
const API_QUERY_URL = "https://aficym0116.execute-api.us-east-1.amazonaws.com/QueryAPI";

// Define available time ranges
const timeRanges = [
  { label: "24hr", value: "24hr" },
  { label: "7 Day", value: "7d" },
  { label: "1 Month", value: "1m" },
  { label: "1 Year", value: "1y" },
  { label: "All Time", value: "all" },
  { label: "Custom", value: "custom" }
];

function App() {
  // Raw API data
  const [data, setData] = useState([]);
  // Data mapped into chart format (with a 'date' property and formatted date string)
  const [mappedData, setMappedData] = useState([]);
  // Filtered data after applying UI controls
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // UI controls
  const [chartFields, setChartFields] = useState(["data1"]);
  const [selectedDevices, setSelectedDevices] = useState(["all"]);
  const [timeRange, setTimeRange] = useState("1m");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Fetch API data on mount.
  useEffect(() => {
    fetch(API_QUERY_URL)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching API data:", err);
        setError("Failed to fetch data");
        setLoading(false);
      });
  }, []);

  // Map API data to include a "date" property and a formatted date string.
  useEffect(() => {
    if (!data.length) return;
    const formatDate = timeFormat("%Y-%m-%d %H:%M");
    const mapped = data
      .map((item) => {
        const timestamp = Number(item.timestamp) * 1000;
        const date = new Date(timestamp);
        if (!timestamp || isNaN(date.getTime())) return null; // skip invalid items
        return {
          ...item,
          date, // Date object
          dateStr: formatDate(date), // formatted string for XAxis
          data1: isNaN(Number(item.data1)) ? 0 : Number(item.data1),
          data2: isNaN(Number(item.data2)) ? 0 : Number(item.data2),
          data3: isNaN(Number(item.data3)) ? 0 : Number(item.data3)
        };
      })
      .filter((d) => d && d.date instanceof Date && !isNaN(d.date.getTime()));
    setMappedData(mapped);
  }, [data]);

  // If timeRange is not custom, auto-set startDate and endDate.
  useEffect(() => {
    if (timeRange !== "custom") {
      const now = new Date();
      let newStart = null;
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

  // Filter mappedData by selected devices and date range.
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
    setFilteredData(
      filtered.filter((d) => d && d.date instanceof Date && !isNaN(d.date.getTime()))
    );
  }, [mappedData, selectedDevices, startDate, endDate]);

  // Build a unique device list.
  const uniqueDevices = ["all", ...new Set(mappedData.map((d) => d.DeviceId))];

  if (loading)
    return <div style={{ textAlign: "center", padding: "2rem" }}>Loading chart data…</div>;
  if (error)
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "red" }}>
        {error}
      </div>
    );

  return (
    <div style={{ padding: "2rem", boxSizing: "border-box" }}>
      <div style={{ maxWidth: "80rem", margin: "0 auto" }}>
      <h2 style={{ textAlign: "center", color: "white" }}>My Chart</h2>


        {/* Controls Section */}
        <div style={{ margin: "1rem 0" }}>
          {/* Time Range Buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
            {timeRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.25rem",
                  border: "none",
                  backgroundColor: timeRange === range.value ? "#2563eb" : "#e5e7eb",
                  color: timeRange === range.value ? "white" : "black"
                }}
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
                    setStartDate(date);
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
                    setEndDate(date);
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
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#6b7280",
                    color: "white",
                    border: "none",
                    borderRadius: "0.25rem"
                  }}
                >
                  Clear Dates
                </button>
              </div>
            </div>
          )}

          {/* Device Filter */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
            {uniqueDevices.map((device) => (
              <button
                key={device}
                onClick={() => {
                  if (device === "all") {
                    setSelectedDevices(["all"]);
                  } else {
                    const alreadySelected = selectedDevices.includes(device);
                    const newDevices = alreadySelected
                      ? selectedDevices.filter((d) => d !== device)
                      : [...selectedDevices.filter((d) => d !== "all"), device];
                    setSelectedDevices(newDevices.length === 0 ? ["all"] : newDevices);
                  }
                }}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.25rem",
                  border: "none",
                  backgroundColor: selectedDevices.includes(device) ? "#2563eb" : "#e5e7eb",
                  color: selectedDevices.includes(device) ? "white" : "black"
                }}
              >
                {device}
              </button>
            ))}
          </div>

          {/* Chart Field Selection */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
            {["data1", "data2", "data3"].map((field) => (
              <button
                key={field}
                onClick={() => {
                  const already = chartFields.includes(field);
                  const newFields = already
                    ? chartFields.filter((f) => f !== field)
                    : [...chartFields, field];
                  setChartFields(newFields);
                }}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.25rem",
                  border: "none",
                  backgroundColor: chartFields.includes(field) ? "#2563eb" : "#e5e7eb",
                  color: chartFields.includes(field) ? "white" : "black"
                }}
              >
                {field}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Section */}
        <div style={{ margin: "2rem 0" }}>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={filteredData} margin={{ left: 20, right: 20, top: 20, bottom: 130 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateStr"
                domain={['auto', 'auto']}
                tickFormatter={(tick) => timeFormat("%Y-%m-%d %H:%M")(new Date(tick))}
                angle={-90}
                textAnchor="end" />
              <YAxis />
              <Tooltip labelFormatter={(value) => value} />
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
        </div>

        {/* Download CSV */}
        <div style={{ textAlign: "right", marginBottom: "2rem" }}>
          <button
            onClick={() => {
              if (!data.length) return;
              const headers = Object.keys(data[0]);
              const csvRows = [headers.join(",")];
              data.forEach((item) => {
                const values = headers.map((header) => item[header]);
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
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "0.25rem",
              cursor: "pointer"
            }}
          >
            Download CSV
          </button>
        </div>


      </div>
    </div>
  );
}

export default App;
