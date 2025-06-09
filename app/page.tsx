"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import DataChart1 from "./components/DataChart1"
import dynamic from "next/dynamic"
const VehicleMap = dynamic(() => import("./components/VehicleMap"), { ssr: false })
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import type { ApiDataItem } from "./components/DataChart1"
import type { DeviceData } from "./components/VehicleMap"
import { config, getLogoutUrl } from "@/lib/config"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
} from "chart.js"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

type ParamItem = {
  key: string
  value: string
}

type TimeRange = "24hr" | "7d" | "1m" | "1y" | "all" | "custom"
const timeRanges: { label: string; value: TimeRange }[] = [
  { label: "24hr", value: "24hr" },
  { label: "7 Day", value: "7d" },
  { label: "1 Month", value: "1m" },
  { label: "1 Year", value: "1y" },
  { label: "All Time", value: "all" },
  { label: "Custom", value: "custom" },
]

const allFields = [
  "quality_min",
  "quality_avg",
  "lat",
  "lon",
  "alt_m",
  "speed_kmh",
  "heading_deg",
  "voltage_v",
  "min",
  "avg",
  "max",
  "temperature_c",
  "signal_strength_dbm",
  "speed",
  "accel_x",
  "accel_y",
  "accel_z",
  "power_kw",
]

export default function Home() {
  const auth = useAuth()

  const [data, setData] = useState<ApiDataItem[]>([])
  const [filteredData, setFilteredData] = useState<ApiDataItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [chartFields, setChartFields] = useState<string[]>(["voltage_v"])
  const [selectedDevices, setSelectedDevices] = useState<string[]>(["all"])
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>("1m")
  const [chartData, setChartData] = useState<ChartData<"line">>({ labels: [], datasets: [] })
  const [command, setCommand] = useState("")
  const [params, setParams] = useState<ParamItem[]>([])
  const [commandLoading, setCommandLoading] = useState(false)
  const [commandSuccess, setCommandSuccess] = useState("")
  const [apiData, setApiData] = useState<ApiDataItem[]>([])
  const [latestData, setLatestData] = useState<DeviceData[]>([])
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(5)

  const fetchLatestData = () => {
    fetch(config.api.gnssTime, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Latest API ${res.status}: ${await res.text()}`)
        return res.json()
      })
      .then((raw) => {
        const mapped: DeviceData[] = raw.map((item: any) => ({
          deviceId: item.deviceID,
          latitude: item.gnss?.lat ?? 0,
          longitude: item.gnss?.lon ?? 0,
          timestamp: item.timestamp,
          soc: item.soc,
          efficiency: item.efficiency,
        }))
        setLatestData(mapped)
      })
      .catch((err) => console.error("Fetching latest locations failed:", err))
  }

  // Use the centralized logout function
  const signOutRedirect = () => {
    window.location.href = getLogoutUrl()
  }

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user) return
    fetchLatestData()
    let interval: ReturnType<typeof setInterval>
    if (autoRefresh) {
      interval = setInterval(fetchLatestData, refreshIntervalSec * 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [auth.isAuthenticated, auth.user, autoRefresh, refreshIntervalSec])

  useEffect(() => {
    if (!auth.isAuthenticated || !startDate || !endDate) return

    setLoading(true)

    // strip off milliseconds:
    const startIso = startDate.toISOString().split(".")[0] + "Z"
    const endIso = endDate.toISOString().split(".")[0] + "Z"

    const params = new URLSearchParams({
      start: startIso,
      end: endIso,
      points: "24",
    })

    fetch(`${config.api.query}?${params}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`API ${res.status}: ${await res.text()}`)
        }
        return res.json()
      })
      .then((json) => {
        setApiData(Array.isArray(json) ? json : [])
      })
      .catch((err) => {
        console.error(err)
        setError(err.message)
        setApiData([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [auth.isAuthenticated, startDate, endDate])

  // Update date range based on selected timeRange
  useEffect(() => {
    if (timeRange !== "custom") {
      const now = new Date()
      let newStart: Date | null = null
      switch (timeRange) {
        case "24hr":
          newStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case "7d":
          newStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case "1m":
          newStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
          break
        case "1y":
          newStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
          break
        case "all":
        default:
          newStart = null
      }
      setStartDate(newStart)
      setEndDate(now)
    }
  }, [timeRange])

  // Filter data
  useEffect(() => {
    let filtered = data
    if (!selectedDevices.includes("all")) {
      filtered = filtered.filter((item) => selectedDevices.includes(item.deviceID))
    }
    if (startDate) {
      filtered = filtered.filter((item) => new Date(Number(item.timestamp) * 1000) >= startDate!)
    }
    if (endDate) {
      filtered = filtered.filter((item) => new Date(Number(item.timestamp) * 1000) <= endDate!)
    }
    setFilteredData(filtered)
  }, [data, selectedDevices, startDate, endDate])

  // Update chart data
  useEffect(() => {
    if (filteredData.length === 0) {
      setChartData({ labels: [], datasets: [] })
      return
    }
    const sorted = [...filteredData].sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
    const labels = sorted.map((item) => new Date(Number(item.timestamp) * 1000).toLocaleString())
    const datasets = chartFields.map((field) => ({
      label: `${field} over time`,
      data: sorted.map((item) => Number((item as Record<string, any>)[field])),
      fill: false,
      borderColor: "rgb(75, 192, 192)",
      tension: 0.1,
    }))
    setChartData({ labels, datasets })
  }, [filteredData, chartFields])

  const uniqueDevices = ["all", ...new Set(data.map((item) => item.deviceID))]

  const handleAddParam = () => {
    if (params.length < 10) {
      setParams([...params, { key: "", value: "" }])
    }
  }

  const handleParamChange = (index: number, field: "key" | "value", value: string) => {
    const newParams = [...params]
    newParams[index][field] = value
    setParams(newParams)
  }

  const handleRemoveParam = (index: number) => {
    const newParams = [...params]
    newParams.splice(index, 1)
    setParams(newParams)
  }

  const handleCommandSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCommandLoading(true)
    setCommandSuccess("")
    setError("")

    const paramsObj: Record<string, string> = {}
    params.forEach((p) => {
      if (p.key) paramsObj[p.key] = p.value
    })

    const payload = {
      command,
      params: paramsObj,
    }

    fetch(config.api.command, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    })
      .then(async (res) => {
        const text = await res.text()
        try {
          JSON.parse(text)
          setCommandSuccess("Command sent successfully")
        } catch {
          setCommandSuccess("Command sent (non-JSON response)")
        }
        setCommand("")
        setParams([])
        setCommandLoading(false)
      })
      .catch(() => {
        setError("Failed to send command")
        setCommandLoading(false)
      })
  }

  const downloadCSV = () => {
    if (data.length === 0) return
    const headers = Object.keys(data[0])
    const csvRows = [headers.join(",")]
    data.forEach((item) => {
      const values = headers.map((header) => `${(item as Record<string, any>)[header]}`)
      csvRows.push(values.join(","))
    })
    const csvData = csvRows.join("\n")
    const blob = new Blob([csvData], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.setAttribute("hidden", "")
    a.setAttribute("href", url)
    a.setAttribute("download", "esp_data.csv")
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const filteredApiData = apiData.filter((item) => {
    const ts = new Date(item.timestamp)
    if (startDate && ts < startDate) return false
    if (endDate && ts > endDate) return false
    if (!selectedDevices.includes("all") && !selectedDevices.includes(item.deviceID)) return false
    return true
  })

  return (
    <main className="min-h-screen p-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="flex justify-end mb-4">
        <button onClick={signOutRedirect} className="btn-danger">
          Logout
        </button>
      </div>
      <div className="max-w-[90vw] mx-auto">
        <h1
          className="text-4xl font-semibold text-center mb-6 tracking-tight"
          style={{ color: "var(--text-color-default)" }}
        >
          EV Telematics Hub
        </h1>
        <div className="p-4">
          <h1 className="text-sm mb-6 text-center" style={{ color: "var(--text-color-default)" }}>
            V1.05: Secure, injection, sourcing, mapping, graphing
          </h1>
        </div>

        <div className="p-4">
          <div className="card p-4 mb-4">
            {/* Time Range */}
            <div className="flex flex-wrap gap-2 mb-4">
              {timeRanges.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setTimeRange(r.value)}
                  className={timeRange === r.value ? "btn-primary" : "btn-secondary"}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {/* Custom Pickers */}
            {timeRange === "custom" && (
              <div className="flex gap-4 mb-4">
                <DatePicker
                  selected={startDate}
                  onChange={(d) => {
                    setStartDate(d)
                    setTimeRange("custom")
                  }}
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  showTimeSelect
                  dateFormat="Pp"
                  placeholderText="Start Date"
                  className="form-input"
                />
                <DatePicker
                  selected={endDate}
                  onChange={(d) => {
                    setEndDate(d)
                    setTimeRange("custom")
                  }}
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  minDate={startDate || undefined}
                  showTimeSelect
                  dateFormat="Pp"
                  placeholderText="End Date"
                  className="form-input"
                />
                <button
                  onClick={() => {
                    setStartDate(null)
                    setEndDate(null)
                    setTimeRange("all")
                  }}
                  className="btn-secondary"
                >
                  Clear
                </button>
              </div>
            )}
            {/* Device Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              {["all", ...new Set(apiData.map((d) => d.deviceID))].map((dev) => (
                <button
                  key={dev}
                  onClick={() => {
                    setSelectedDevices((prev) => {
                      if (dev === "all") return ["all"]
                      const next = prev.includes(dev)
                        ? prev.filter((d) => d !== dev)
                        : [...prev.filter((d) => d !== "all"), dev]
                      return next.length ? next : ["all"]
                    })
                  }}
                  className={selectedDevices.includes(dev) ? "btn-primary" : "btn-secondary"}
                >
                  {dev}
                </button>
              ))}
            </div>
            {/* Field Selector */}
            <div className="flex flex-wrap gap-2">
              {allFields.map((f) => (
                <button
                  key={f}
                  onClick={() => setChartFields((cf) => (cf.includes(f) ? cf.filter((x) => x !== f) : [...cf, f]))}
                  className={chartFields.includes(f) ? "btn-primary" : "btn-secondary"}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <DataChart1 data={filteredApiData} chartFields={chartFields} loading={loading} />
        </div>

        <section className="card p-4 mb-4">
          <h2 className="text-2xl font-semibold mb-4">Send Command to ESP</h2>
          <form onSubmit={handleCommandSubmit}>
            <div className="mb-4">
              <label className="form-label">Command</label>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Enter command (e.g., turn_on)"
                className="form-input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="form-label">Parameters</label>
              {params.map((param, index) => (
                <div key={index} className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={param.key}
                    onChange={(e) => handleParamChange(index, "key", e.target.value)}
                    placeholder="Key"
                    className="form-input"
                    required
                  />
                  <input
                    type="text"
                    value={param.value}
                    onChange={(e) => handleParamChange(index, "value", e.target.value)}
                    placeholder="Value"
                    className="form-input"
                    required
                  />
                  <button type="button" onClick={() => handleRemoveParam(index)} className="btn-danger">
                    Remove
                  </button>
                </div>
              ))}
              {params.length < 10 && (
                <button type="button" onClick={handleAddParam} className="btn-secondary">
                  Add Parameter
                </button>
              )}
            </div>
            <div>
              <button type="submit" disabled={commandLoading} className="btn-primary">
                {commandLoading ? "Sending..." : "Send Command"}
              </button>
            </div>
            {commandSuccess && (
              <p className="mt-2" style={{ color: "#22c55e" }}>
                {commandSuccess}
              </p>
            )}
            {error && (
              <p className="mt-2" style={{ color: "#ef4444" }}>
                {error}
              </p>
            )}
          </form>
        </section>

        <section className="p-4">
          <h1 className="text-2xl mb-4">Vehicle Map</h1>
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center" style={{ color: "var(--text-color-default)" }}>
              <span className="mr-2">Auto Refresh</span>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="form-checkbox h-5 w-5"
              />
            </label>
            {autoRefresh && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={refreshIntervalSec}
                  min={1}
                  onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
                  className="form-input w-16"
                />
                <span style={{ color: "var(--text-color-default)" }}>sec</span>
              </div>
            )}
            <button onClick={fetchLatestData} className="btn-secondary">
              Refresh Now
            </button>
          </div>
          {latestData.length === 0 ? (
            <div className="text-center" style={{ color: "var(--text-color-default)" }}>
              Loading latest locations...
            </div>
          ) : (
            <VehicleMap devices={latestData} />
          )}
        </section>
      </div>
    </main>
  )
}
