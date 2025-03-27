"use client";

import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type DataItem = {
  DeviceId: string;
  timestamp: string;
  [key: string]: any;
};

type ParamItem = {
  key: string;
  value: string;
};

export default function Home() {
  const [data, setData] = useState<DataItem[]>([]);
  const [filteredData, setFilteredData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Chart/filter
  const [chartFields, setChartFields] = useState<string[]>(["data1"]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>(["all"]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [chartData, setChartData] = useState<ChartData<"line">>({
    labels: [],
    datasets: [],
  });

  // Command form
  const [command, setCommand] = useState("");
  const [params, setParams] = useState<ParamItem[]>([]);
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandSuccess, setCommandSuccess] = useState("");

  const API_QUERY_URL = "https://aficym0116.execute-api.us-east-1.amazonaws.com/QueryAPI";
  const API_COMMAND_URL = "https://3fo7p4w6v6.execute-api.us-east-1.amazonaws.com/SendDataToESP";

  useEffect(() => {
    setLoading(true);
    fetch(API_QUERY_URL)
      .then((res) => res.json())
      .then((json: DataItem[]) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to fetch data");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let filtered = data;
    if (!selectedDevices.includes("all")) {
      filtered = filtered.filter((item) => selectedDevices.includes(item.DeviceId));
    }
    if (startDate) {
      filtered = filtered.filter(
        (item) => new Date(Number(item.timestamp) * 1000) >= startDate
      );
    }
    if (endDate) {
      filtered = filtered.filter(
        (item) => new Date(Number(item.timestamp) * 1000) <= endDate
      );
    }
    setFilteredData(filtered);
  }, [data, selectedDevices, startDate, endDate]);

  useEffect(() => {
    if (filteredData.length === 0) {
      setChartData({ labels: [], datasets: [] });
      return;
    }
    const sorted = [...filteredData].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    const labels = sorted.map((item) =>
      new Date(Number(item.timestamp) * 1000).toLocaleString()
    );
    const datasets = chartFields.map((field) => ({
      label: `${field} over time`,
      data: sorted.map((item) => Number(item[field]) || 0),
      fill: false,
      borderColor: "rgb(75, 192, 192)",
      tension: 0.1,
    }));
    setChartData({ labels, datasets });
  }, [filteredData, chartFields]);

  const uniqueDevices = ["all", ...new Set(data.map((item) => item.DeviceId))];

  const handleAddParam = () => {
    if (params.length < 10) {
      setParams([...params, { key: "", value: "" }]);
    }
  };

  const handleParamChange = (index: number, field: "key" | "value", value: string) => {
    const newParams = [...params];
    newParams[index][field] = value;
    setParams(newParams);
  };

  const handleRemoveParam = (index: number) => {
    const newParams = [...params];
    newParams.splice(index, 1);
    setParams(newParams);
  };

  const handleCommandSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCommandLoading(true);
    setCommandSuccess("");
    setError("");

    const paramsObj: Record<string, string> = {};
    params.forEach((p) => {
      if (p.key) paramsObj[p.key] = p.value;
    });

    const payload = {
      command,
      params: paramsObj,
    };

    fetch(API_COMMAND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const text = await res.text();
        try {
          JSON.parse(text);
          setCommandSuccess("Command sent successfully");
        } catch {
          setCommandSuccess("Command sent (non-JSON response)");
        }
        setCommand("");
        setParams([]);
        setCommandLoading(false);
      })
      .catch(() => {
        setError("Failed to send command");
        setCommandLoading(false);
      });
  };

  const downloadCSV = () => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(",")];
    data.forEach((item) => {
      const values = headers.map((header) => `"${item[header]}"`);
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
  };

  return (
    <main className="min-h-screen p-4 bg-[var(--background)]">
      <div className=" max-w-[80vw] mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-center">EV Telematics Hub</h1>

        {/* Chart Section */}
        <section className="bg-[var(--background)] shadow-md rounded p-4 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Data Chart</h2>
          <div className="flex flex-col md:flex-row md:space-x-4 mb-4">
            <div className="flex-1 mb-4 md:mb-0">
              <label className="block text-sm font-medium mb-1">Device Filter</label>
              <div className="flex flex-wrap gap-2">
                {uniqueDevices.map((device) => {
                  const selected = selectedDevices.includes(device);
                  return (
                    <button
                      key={device}
                      onClick={() => {
                        if (device === "all") {
                          setSelectedDevices(["all"]);
                        } else {
                          const newDevices = selected
                            ? selectedDevices.filter((d) => d !== device)
                            : [...selectedDevices.filter((d) => d !== "all"), device];
                          setSelectedDevices(newDevices.length === 0 ? ["all"] : newDevices);
                        }
                      }}
                      className={`px-3 py-1 rounded text-sm ${
                        selected
                          ? "bg-blue-600 text-white border-transparent"
                          : "bg-gray-200 text-black border border-gray-300"
                      }`}
                      
                    >
                      {device}
                    </button>
                  );
                })}
              </div>

            </div>
            <div className="flex-1 mb-4 md:mb-0">
              <label className="block text-sm font-medium mb-1">Chart Field</label>
              <div className="flex flex-wrap gap-2">
                {["data1", "data2", "data3"].map((field) => {
                  const selected = chartFields.includes(field);
                  return (
                    <button
                      key={field}
                      onClick={() => {
                        const newFields = selected
                          ? chartFields.filter((f) => f !== field)
                          : [...chartFields, field];
                        setChartFields(newFields);
                      }}
                      className={`px-3 py-1 rounded text-sm ${
                        selected
                          ? "bg-blue-600 text-white border-transparent"
                          : "bg-gray-200 text-black border border-gray-300"
                      }`}
                      
                    >
                      {field}
                    </button>
                  );
                })}
              </div>

            </div>
            <div className="flex-1 mb-4 md:mb-0">
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                className="w-full p-2 border rounded"
                placeholderText="Select start date"
                showTimeSelect
                dateFormat="Pp"
                popperPlacement="bottom-start"
              />
            </div>
            <div className="flex-1 mb-4 md:mb-0">
              <label className="block text-sm font-medium mb-1">End Date</label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate ?? undefined}
                className="w-full p-2 border rounded"
                placeholderText="Select end date"
                showTimeSelect
                dateFormat="Pp"
                popperPlacement="bottom-start"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
            >
              Clear Dates
            </button>
          </div>
          {loading ? (
            <p>Loading data...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : (
            <>
              <Line data={chartData} />
              <div className="mt-4 flex justify-end">
                <button
                  onClick={downloadCSV}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                >
                  Download CSV
                </button>
              </div>
            </>
          )}
        </section>

        {/* Command Injection Section */}
        <section className="bg-[var(--background)] shadow-md rounded p-4">
          <h2 className="text-2xl font-semibold mb-4">Send Command to ESP</h2>
          <form onSubmit={handleCommandSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Command</label>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Enter command (e.g., turn_on)"
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Parameters</label>
              {params.map((param, index) => (
                <div key={index} className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={param.key}
                    onChange={(e) => handleParamChange(index, "key", e.target.value)}
                    placeholder="Key"
                    className="w-1/2 p-2 border rounded"
                    required
                  />
                  <input
                    type="text"
                    value={param.value}
                    onChange={(e) => handleParamChange(index, "value", e.target.value)}
                    placeholder="Value"
                    className="w-1/2 p-2 border rounded"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveParam(index)}
                    className="px-2 py-1 bg-red-500 text-white rounded"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {params.length < 10 && (
                <button
                  type="button"
                  onClick={handleAddParam}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
                >
                  Add Parameter
                </button>
              )}
            </div>
            <div>
              <button
                type="submit"
                disabled={commandLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                {commandLoading ? "Sending..." : "Send Command"}
              </button>
            </div>
            {commandSuccess && <p className="mt-2 text-green-600">{commandSuccess}</p>}
            {error && <p className="mt-2 text-red-600">{error}</p>}
          </form>
        </section>
      </div>
    </main>
  );
}
