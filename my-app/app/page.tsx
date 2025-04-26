"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import DataChart1 from "./components/DataChart1";
import dynamic from "next/dynamic";
const VehicleMap = dynamic(() => import("./components/VehicleMap"), { ssr: false });
import { sampleDevices } from "./components/sampleDevices";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import type { ApiDataItem } from "./components/DataChart1";
import type { DeviceData } from "./components/VehicleMap";
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


// type DataItem = {
//   DeviceId: string;
//   timestamp: string;
//   [key: string]: any;
// };

type ParamItem = {
  key: string;
  value: string;
};

type TimeRange = "24hr" | "7d" | "1m" | "1y" | "all" | "custom";
const timeRanges: { label: string; value: TimeRange }[] = [
  { label: "24hr",   value: "24hr" },
  { label: "7 Day",  value: "7d"   },
  { label: "1 Month",value: "1m"   },
  { label: "1 Year", value: "1y"   },
  { label: "All Time",value: "all" },
  { label: "Custom", value: "custom"}
];

const allFields = [
  "quality_min","quality_avg","lat","lon","alt_m","speed_kmh","heading_deg",
  "voltage_v","min","avg","max","temperature_c","signal_strength_dbm",
  "speed","accel_x","accel_y","accel_z","power_kw"
];


export default function Home() {
  const auth = useAuth();

  const [data, setData] = useState<ApiDataItem[]>([]);
  const [filteredData, setFilteredData] = useState<ApiDataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chartFields, setChartFields] = useState<string[]>(["voltage_v"]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>(["all"]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("1m");
  const [chartData, setChartData] = useState<ChartData<"line">>({ labels: [], datasets: [] });
  const [command, setCommand] = useState("");
  const [params, setParams] = useState<ParamItem[]>([]);
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandSuccess, setCommandSuccess] = useState("");
  const [apiData, setApiData] = useState<ApiDataItem[]>([]);
  const [latestData, setLatestData] = useState<DeviceData[]>([]);




  const API_QUERY_URL   = "/api/query";
  const API_COMMAND_URL = "/api/command";
  const API_LATEST_URL = "/api/LatestTimestream";
  // Use the same sign-out function as in Dashboard:
  const signOutRedirect = () => {
    const clientId = "79ufsa70isosab15kpcmlm628d";
    const logoutUri = "https://telematicshub.vercel.app/logout-callback";
    const cognitoDomain = "https://us-east-1dlb9dc7ko.auth.us-east-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };









  useEffect(() => {
    if (!auth.isAuthenticated || !startDate || !endDate) return;
  
    setLoading(true);
    // const token = auth.user!.access_token!;
  
    // strip off milliseconds:
    const startIso = startDate.toISOString().split('.')[0] + 'Z';
    const endIso   = endDate  .toISOString().split('.')[0] + 'Z';
  
    const params = new URLSearchParams({
      start:  startIso,
      end:    endIso,
      points: "24"
    });
  
    fetch(`${API_QUERY_URL}?${params}`, {
      credentials: "include"  // ← tell the browser to send HttpOnly cookies
    })
    
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`API ${res.status}: ${await res.text()}`);
        }
        return res.json();
      })
      .then((json) => {
        setApiData(Array.isArray(json) ? json : []);
      })

      

      .catch((err) => {
        console.error(err);
        setError(err.message);
        setApiData([]);
      })
      .finally(() => {
        setLoading(false);
      });
      
  }, [auth.isAuthenticated, startDate, endDate]);



  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user) return;
    fetch(API_LATEST_URL, { credentials: "include" })
      .then(async res => {
        if (!res.ok) throw new Error(`Latest API ${res.status}: ${await res.text()}`);
        return res.json() as Promise<DeviceData[]>;
      })
      .then(data => setLatestData(data))
      .catch(err => console.error("Fetching latest locations failed:", err));
  }, [auth.isAuthenticated, auth.user]);

  // Update date range based on selected timeRange
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

  // Filter data
  useEffect(() => {
    let filtered = data;
    if (!selectedDevices.includes("all")) {
      filtered = filtered.filter((item) => selectedDevices.includes(item.deviceID));
    }
    if (startDate) {
      filtered = filtered.filter((item) => new Date(Number(item.timestamp) * 1000) >= startDate!);
    }
    if (endDate) {
      filtered = filtered.filter((item) => new Date(Number(item.timestamp) * 1000) <= endDate!);
    }
    setFilteredData(filtered);
  }, [data, selectedDevices, startDate, endDate]);

  // Update chart data
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
      data: sorted.map((item) => Number((item as Record<string, any>)[field])),
      fill: false,
      borderColor: "rgb(75, 192, 192)",
      tension: 0.1,
    }));
    setChartData({ labels, datasets });
  }, [filteredData, chartFields]);

  const uniqueDevices = ["all", ...new Set(data.map((item) => item.deviceID))];


  
  
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
    const atoken = auth.user?.access_token;
    const aidtoken = auth.user?.id_token;
    
    
    console.log("Using acctoken:", atoken?.substring(0, 999) + "...");
    console.log("Using aIDtoken:", aidtoken?.substring(0, 999) + "...");
    

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
      const values = headers.map((header) => `${(item as Record<string, any>)[header]}`);
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

  const filteredApiData = apiData.filter((item) => {
    const ts = new Date(item.timestamp)
    if (startDate && ts < startDate) return false
    if (endDate   && ts > endDate)   return false
    if (!selectedDevices.includes("all") &&
        !selectedDevices.includes(item.deviceID)
    ) return false
    return true
  })

  return (
    <main className="min-h-screen p-4 bg-[var(--background)]">
      <div className="flex justify-end mb-4">
        <button onClick={signOutRedirect} className="bg-red-600 text-white px-4 py-2 rounded">
          Logout
        </button>
      </div>
      <div className="max-w-[90vw] mx-auto">
        <h1 className="text-4xl font-semibold text-center mb-6 tracking-tight">
        <span className="text-white">
          EV Telematics Hub
        </span>
        </h1>
        <div className="p-4">
          <h1 className="text-sm text-white mb-6 text-center">V1.05: Secure, injection, sourcing, mapping, graphing</h1>
        </div>

        <div className="p-4">
          {/* <DataChart1 token={auth.user?.access_token as string} /> */}

         
<div className="p-4 bg-[var(--background)] shadow-md rounded mb-4">
  {/* Time Range */}
  <div className="flex flex-wrap gap-2 mb-4">
    {timeRanges.map((r) => (
      <button key={r.value}
        onClick={() => setTimeRange(r.value)}
        className={`px-4 py-2 rounded text-sm ${
          timeRange === r.value ? "bg-blue-600 text-white" : "bg-gray-200 text-black"
        }`}
      >{r.label}</button>
    ))}
  </div>
  {/* Custom Pickers */}
  {timeRange === "custom" && (
    <div className="flex gap-4 mb-4">
      <DatePicker
        selected={startDate}
        onChange={(d) => { setStartDate(d); setTimeRange("custom"); }}
        selectsStart startDate={startDate} endDate={endDate}
        showTimeSelect dateFormat="Pp" placeholderText="Start Date"
      />
      <DatePicker
        selected={endDate}
        onChange={(d) => { setEndDate(d); setTimeRange("custom"); }}
        selectsEnd startDate={startDate} endDate={endDate}
        minDate={startDate || undefined}
        showTimeSelect dateFormat="Pp" placeholderText="End Date"
      />
      <button
        onClick={() => { setStartDate(null); setEndDate(null); setTimeRange("all"); }}
        className="px-4 py-2 rounded bg-gray-600 text-white"
      >Clear</button>
    </div>
  )}
  {/* Device Filter */}
  <div className="flex flex-wrap gap-2 mb-4">
    {["all", ...new Set(apiData.map((d) => d.deviceID))].map((dev) => (
      <button key={dev}
      onClick={() => {
        setSelectedDevices((prev) => {
          if (dev === "all") return ["all"];
          const next = prev.includes(dev)
            ? prev.filter((d) => d !== dev)
            : [...prev.filter((d) => d !== "all"), dev];
          return next.length ? next : ["all"];
        });
      }}
        className={`px-3 py-1 rounded text-sm ${
          selectedDevices.includes(dev) ? "bg-blue-600 text-white" : "bg-gray-200 text-black"
        }`}
      >{dev}</button>
    ))}
  </div>
  {/* Field Selector */}
  <div className="flex flex-wrap gap-2">
    {allFields.map((f) => (
      <button key={f}
        onClick={() =>
          setChartFields((cf) =>
            cf.includes(f) ? cf.filter((x) => x !== f) : [...cf, f]
          )
        }
        className={`px-3 py-1 rounded text-sm ${
          chartFields.includes(f) ? "bg-blue-600 text-white" : "bg-gray-200 text-black"
        }`}
      >{f}</button>
    ))}
  </div>
</div>

        <DataChart1 data={filteredApiData} chartFields={chartFields} loading={loading} />


        </div>
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
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded cursor-pointer"
                >
                  Add Parameter
                </button>
              )}
            </div>
            <div>
              <button
                type="submit"
                disabled={commandLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded cursor-pointer"
              >
                {commandLoading ? "Sending..." : "Send Command"}
              </button>
            </div>
            {commandSuccess && <p className="mt-2 text-green-600">{commandSuccess}</p>}
            {error && <p className="mt-2 text-red-600">{error}</p>}
          </form>
        </section>
        <section className="p-4">
          <h1 className="text-2xl mb-4">Vehicle Map</h1>
          {latestData.length === 0 ? (
            <div className="text-center text-white">Loading latest locations...</div>
          ) : (
            <VehicleMap devices={latestData} />
          )}
        </section>
        
        
      </div>
    </main>
  );
}
