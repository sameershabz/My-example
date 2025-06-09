"use client"

import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import DataChart1, { type ApiDataItem } from "./components/DataChart1"
import dynamic from "next/dynamic"
import { sampleDevices } from "./components/sampleDevices"
import TimeRangeSelector, { type TimeRange } from "./components/TimeRangeSelector"
import DeviceSelector from "./components/DeviceSelector"
import FieldSelector from "./components/FieldSelector"
import CommandInterface from "./components/CommandInterface"
import DashboardLayout from "./components/layout/DashboardLayout"
import { Loader2, RefreshCw } from "lucide-react"

// Import VehicleMap dynamically to avoid SSR issues with Leaflet
const VehicleMap = dynamic(() => import("./components/VehicleMap"), { ssr: false })

// Define all available fields
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
  "soc",
  "efficiency",
]

export default function Home() {
  const auth = useAuth()

  // State for data and filtering
  const [apiData, setApiData] = useState<ApiDataItem[]>([])
  const [filteredData, setFilteredData] = useState<ApiDataItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // State for filters
  const [chartFields, setChartFields] = useState<string[]>(["voltage_v", "soc"])
  const [selectedDevices, setSelectedDevices] = useState<string[]>(["all"])
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>("24hr")

  // State for map
  const [latestData, setLatestData] = useState<any[]>([])
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(30)
  const [refreshing, setRefreshing] = useState(false)

  // API endpoints
  const API_QUERY_URL = "/api/query"
  const API_LATEST_URL = "/api/GNSSTime"

  // Check if auth is available and authenticated
  const isAuthenticated = auth?.isAuthenticated ?? false
  const isLoading = auth?.isLoading ?? true

  // Fetch latest location data
  const fetchLatestData = async () => {
    if (!isAuthenticated) return

    setRefreshing(true)
    try {
      const res = await fetch(API_LATEST_URL, { credentials: "include" })

      if (!res.ok) {
        throw new Error(`Latest API ${res.status}: ${await res.text()}`)
      }

      const raw = await res.json()
      const mapped = Array.isArray(raw)
        ? raw.map((item: any) => ({
            deviceId: item.deviceID || item.deviceId,
            latitude: item.gnss?.lat ?? item.latitude ?? 0,
            longitude: item.gnss?.lon ?? item.longitude ?? 0,
            timestamp: item.timestamp,
            soc: item.soc ?? 0,
            efficiency: item.efficiency ?? 0,
          }))
        : []

      setLatestData(mapped)
    } catch (err) {
      console.error("Fetching latest locations failed:", err)
      // If API fails, use sample data for demo purposes
      setLatestData(sampleDevices)
    } finally {
      setRefreshing(false)
    }
  }

  // Fetch historical data based on time range
  const fetchHistoricalData = async () => {
    if (!isAuthenticated || !startDate || !endDate) return

    setLoading(true)
    setError("")

    // Format dates for API
    const startIso = startDate.toISOString().split(".")[0] + "Z"
    const endIso = endDate.toISOString().split(".")[0] + "Z"

    const params = new URLSearchParams({
      start: startIso,
      end: endIso,
      points: "100", // Request more data points for better visualization
    })

    try {
      const res = await fetch(`${API_QUERY_URL}?${params}`, {
        credentials: "include",
      })

      if (!res.ok) {
        throw new Error(`API ${res.status}: ${await res.text()}`)
      }

      const json = await res.json()
      const data = Array.isArray(json) ? json : []
      setApiData(data)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
      setApiData([])
    } finally {
      setLoading(false)
    }
  }

  // Set up auto-refresh for map data
  useEffect(() => {
    if (!isAuthenticated) return

    fetchLatestData()

    let interval: ReturnType<typeof setInterval>
    if (autoRefresh) {
      interval = setInterval(fetchLatestData, refreshIntervalSec * 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isAuthenticated, autoRefresh, refreshIntervalSec])

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
          newStart = new Date(2020, 0, 1) // Some reasonable default for "all"
      }

      setStartDate(newStart)
      setEndDate(now)
    }
  }, [timeRange])

  // Filter data based on selected devices
  useEffect(() => {
    let filtered = apiData

    if (!selectedDevices.includes("all")) {
      filtered = filtered.filter((item) => selectedDevices.includes(item.deviceID))
    }

    setFilteredData(filtered)
  }, [apiData, selectedDevices])

  // Get unique device IDs from the data
  const uniqueDevices = Array.from(new Set(apiData.map((item) => item.deviceID)))

  // Fetch historical data when auth is ready and time range is set
  useEffect(() => {
    if (isAuthenticated && startDate && endDate) {
      fetchHistoricalData()
    }
  }, [isAuthenticated, startDate, endDate])

  // Show loading state if auth is still loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-700">Loading Telematics Hub...</p>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <h1 className="text-2xl font-bold text-gray-900">Telematics Dashboard</h1>
          <div className="text-sm text-gray-500">Last updated: {new Date().toLocaleString()}</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filters Column */}
          <div className="lg:col-span-1 space-y-4">
            <TimeRangeSelector
              timeRange={timeRange}
              setTimeRange={setTimeRange}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
            />

            <DeviceSelector
              devices={uniqueDevices}
              selectedDevices={selectedDevices}
              setSelectedDevices={setSelectedDevices}
            />

            <FieldSelector fields={allFields} selectedFields={chartFields} setSelectedFields={setChartFields} />
          </div>

          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chart Section */}
            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">Telemetry Data</h2>
              <DataChart1 data={filteredData} chartFields={chartFields} loading={loading} />
              {error && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
            </section>

            {/* Map Section */}
            <section>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-semibold text-gray-800">Vehicle Locations</h2>
                <div className="flex items-center gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Auto refresh</span>
                  </label>

                  {autoRefresh && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={refreshIntervalSec}
                        min={5}
                        onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
                        className="w-16 p-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-sm text-gray-700">sec</span>
                    </div>
                  )}

                  <button
                    onClick={fetchLatestData}
                    disabled={refreshing}
                    className="flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-800 transition-colors"
                  >
                    {refreshing ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    Refresh
                  </button>
                </div>
              </div>

              <VehicleMap devices={latestData} centerOnDevices={true} />
            </section>

            {/* Command Interface */}
            <section>
              <CommandInterface />
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
