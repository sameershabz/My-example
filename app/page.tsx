"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon, RefreshCw, Plus, Trash, Loader2, Send, Settings, Filter, Clock } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import DataChart1 from "./components/DataChart1"
import dynamic from "next/dynamic"
import type { ApiDataItem } from "./components/DataChart1"
import type { DeviceData } from "./components/VehicleMap"
import { config } from "@/lib/config"
import PageLayout from "./components/page-layout"
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

const VehicleMap = dynamic(() => import("./components/VehicleMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
})

type ParamItem = {
  key: string
  value: string
}

type TimeRange = "24hr" | "7d" | "1m" | "1y" | "all" | "custom"
const timeRanges: { label: string; value: TimeRange }[] = [
  { label: "24 Hours", value: "24hr" },
  { label: "7 Days", value: "7d" },
  { label: "1 Month", value: "1m" },
  { label: "1 Year", value: "1y" },
  { label: "All Time", value: "all" },
  { label: "Custom", value: "custom" },
]

// All fields on one level - no subcategorization
const allFields = [
  "voltage_v",
  "temperature_c",
  "speed",
  "speed_kmh",
  "lat",
  "lon",
  "alt_m",
  "heading_deg",
  "quality_min",
  "quality_avg",
  "min",
  "avg",
  "max",
  "signal_strength_dbm",
  "accel_x",
  "accel_y",
  "accel_z",
  "power_kw",
]

// Updated command templates
const commandTemplates = [
  {
    name: "Set WiFi Credentials",
    command: "set_wifi",
    params: [
      { key: "ssid", value: "" },
      { key: "password", value: "" },
    ],
  },
  {
    name: "Kill Device",
    command: "kill_device",
    params: [{ key: "device_id", value: "" }],
  },
  {
    name: "Set Current Sensor",
    command: "set_current_sensor",
    params: [
      { key: "type", value: "fluxgate" },
      { key: "range", value: "1x" },
    ],
  },
  {
    name: "Set Voltage Sensor Range",
    command: "set_voltage_range",
    params: [{ key: "range", value: "1x" }],
  },
  {
    name: "Configure LTE",
    command: "set_lte_config",
    params: [
      { key: "apn", value: "" },
      { key: "username", value: "" },
      { key: "password", value: "" },
    ],
  },
]

export default function Home() {
  const auth = useAuth()
  const [activeTab, setActiveTab] = useState("chart")
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

  // Toggle states for the three concurrent sections
  const [showTimeRange, setShowTimeRange] = useState(true)
  const [showDeviceFilter, setShowDeviceFilter] = useState(false)
  const [showDataFields, setShowDataFields] = useState(false)

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

  const loadCommandTemplate = (template: (typeof commandTemplates)[0]) => {
    setCommand(template.command)
    setParams([...template.params])
  }

  const filteredApiData = apiData.filter((item) => {
    const ts = new Date(item.timestamp)
    if (startDate && ts < startDate) return false
    if (endDate && ts > endDate) return false
    if (!selectedDevices.includes("all") && !selectedDevices.includes(item.deviceID)) return false
    return true
  })

  return (
    <PageLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Monitor your fleet and analyze telemetry data</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-muted to-muted/80 p-1 rounded-xl shadow-lg">
            <TabsTrigger
              value="chart"
              className="rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:scale-105"
            >
              📊 Chart View
            </TabsTrigger>
            <TabsTrigger
              value="map"
              className="rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:scale-105"
            >
              🗺️ Map View
            </TabsTrigger>
            <TabsTrigger
              value="commands"
              className="rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:scale-105"
            >
              ⚡ Commands
            </TabsTrigger>
          </TabsList>

          {/* Chart View Tab */}
          <TabsContent value="chart" className="space-y-6">
            <Card className="shadow-xl border-0 bg-gradient-to-br from-card to-card/95 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  Data Visualization
                </CardTitle>
                <CardDescription className="text-base">Configure your chart settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Control Toggle Buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={showTimeRange ? "default" : "outline"}
                    onClick={() => {
                      setShowTimeRange(!showTimeRange)
                      if (!showTimeRange) {
                        setShowDeviceFilter(false)
                        setShowDataFields(false)
                      }
                    }}
                    className={`
                      px-4 py-2 rounded-lg border-2 font-semibold transition-all duration-300 transform hover:scale-105
                      ${
                        showTimeRange
                          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/25"
                          : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                      }
                    `}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Time Range
                  </Button>

                  <Button
                    variant={showDeviceFilter ? "default" : "outline"}
                    onClick={() => {
                      setShowDeviceFilter(!showDeviceFilter)
                      if (!showDeviceFilter) {
                        setShowTimeRange(false)
                        setShowDataFields(false)
                      }
                    }}
                    className={`
                      px-4 py-2 rounded-lg border-2 font-semibold transition-all duration-300 transform hover:scale-105
                      ${
                        showDeviceFilter
                          ? "bg-gradient-to-r from-green-500 to-green-600 text-white border-green-500 shadow-lg shadow-green-500/25"
                          : "bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:bg-green-50"
                      }
                    `}
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Device Filter
                  </Button>

                  <Button
                    variant={showDataFields ? "default" : "outline"}
                    onClick={() => {
                      setShowDataFields(!showDataFields)
                      if (!showDataFields) {
                        setShowTimeRange(false)
                        setShowDeviceFilter(false)
                      }
                    }}
                    className={`
                      px-4 py-2 rounded-lg border-2 font-semibold transition-all duration-300 transform hover:scale-105
                      ${
                        showDataFields
                          ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/25"
                          : "bg-white text-gray-700 border-gray-300 hover:border-purple-400 hover:bg-purple-50"
                      }
                    `}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Data Fields
                  </Button>
                </div>

                {/* Time Range Section */}
                {showTimeRange && (
                  <div className="p-6 border-2 border-blue-200 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-lg">
                    <h3 className="text-lg font-bold text-blue-800 mb-4">⏰ Select Time Range</h3>
                    <div className="flex flex-wrap gap-3">
                      {timeRanges.map((r) => (
                        <Button
                          key={r.value}
                          variant={timeRange === r.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setTimeRange(r.value)}
                          className={`
                            px-3 py-2 rounded-lg border-2 font-medium transition-all duration-200 transform hover:scale-105
                            ${
                              timeRange === r.value
                                ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600 shadow-md"
                                : "bg-white text-blue-700 border-blue-300 hover:border-blue-500 hover:bg-blue-50"
                            }
                          `}
                        >
                          {r.label}
                        </Button>
                      ))}
                    </div>

                    {/* Custom Date Range */}
                    {timeRange === "custom" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 p-4 bg-white/70 rounded-lg border border-blue-200">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-blue-800">Start Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal bg-white border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0 bg-white border-2 border-blue-300 shadow-xl z-50"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={startDate || undefined}
                                onSelect={setStartDate}
                                initialFocus
                                className="bg-white text-foreground border-0"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-blue-800">End Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal bg-white border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0 bg-white border-2 border-blue-300 shadow-xl z-50"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={endDate || undefined}
                                onSelect={setEndDate}
                                initialFocus
                                className="bg-white text-foreground border-0"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Device Filter Section */}
                {showDeviceFilter && (
                  <div className="p-6 border-2 border-green-200 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 shadow-lg">
                    <h3 className="text-lg font-bold text-green-800 mb-4">🚗 Choose Devices</h3>
                    <div className="flex flex-wrap gap-3">
                      {["all", ...new Set(apiData.map((d) => d.deviceID))].map((dev) => (
                        <Button
                          key={dev}
                          variant={selectedDevices.includes(dev) ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setSelectedDevices((prev) => {
                              if (dev === "all") return ["all"]
                              const next = prev.includes(dev)
                                ? prev.filter((d) => d !== dev)
                                : [...prev.filter((d) => d !== "all"), dev]
                              return next.length ? next : ["all"]
                            })
                          }}
                          className={`
                            px-3 py-2 rounded-lg border-2 font-medium transition-all duration-200 transform hover:scale-105
                            ${
                              selectedDevices.includes(dev)
                                ? "bg-gradient-to-r from-green-600 to-green-700 text-white border-green-600 shadow-md"
                                : "bg-white text-green-700 border-green-300 hover:border-green-500 hover:bg-green-50"
                            }
                          `}
                        >
                          {dev}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Data Fields Section */}
                {showDataFields && (
                  <div className="p-6 border-2 border-purple-200 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 shadow-lg">
                    <h3 className="text-lg font-bold text-purple-800 mb-4">📊 Select Data Fields</h3>
                    <div className="flex flex-wrap gap-3">
                      {allFields.map((field) => (
                        <Button
                          key={field}
                          variant={chartFields.includes(field) ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setChartFields((cf) =>
                              cf.includes(field) ? cf.filter((x) => x !== field) : [...cf, field],
                            )
                          }
                          className={`
                            px-3 py-2 rounded-lg border-2 font-medium transition-all duration-200 transform hover:scale-105
                            ${
                              chartFields.includes(field)
                                ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white border-purple-600 shadow-md"
                                : "bg-white text-purple-700 border-purple-300 hover:border-purple-500 hover:bg-purple-50"
                            }
                          `}
                        >
                          {field}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chart */}
                <div className="pt-6">
                  <DataChart1 data={filteredApiData} chartFields={chartFields} loading={loading} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Map View Tab */}
          <TabsContent value="map" className="space-y-4">
            <Card className="shadow-xl border-0 bg-gradient-to-br from-card to-card/95 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-2xl bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                    🗺️ Vehicle Locations
                  </CardTitle>
                  <CardDescription className="text-base">
                    Real-time positions of {latestData.length} vehicles
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="autoRefresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                    <Label htmlFor="autoRefresh" className="text-sm font-medium">
                      Auto Refresh
                    </Label>
                  </div>
                  {autoRefresh && (
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={refreshIntervalSec}
                        onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
                        min={1}
                        className="w-16 h-8 border-2 border-border"
                      />
                      <span className="text-sm text-muted-foreground">sec</span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchLatestData}
                    disabled={loading}
                    className="bg-white text-foreground border-2 border-border hover:bg-muted hover:border-muted-foreground transition-all duration-200 transform hover:scale-105"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[500px] w-full rounded-xl border-2 border-border overflow-hidden bg-muted/10 shadow-inner">
                  <VehicleMap devices={latestData} />
                </div>
              </CardContent>
            </Card>

            {latestData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-blue-800">🚗 Total Vehicles</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">{latestData.length}</div>
                    <p className="text-xs text-blue-600/70">Active in fleet</p>
                  </CardContent>
                </Card>

                <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-green-800">🔋 Good Battery</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      {latestData.filter((d) => d.soc > 20).length}
                    </div>
                    <p className="text-xs text-green-600/70">SoC above 20%</p>
                  </CardContent>
                </Card>

                <Card className="shadow-lg border-0 bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-orange-800">⚠️ Low Battery</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600">
                      {latestData.filter((d) => d.soc <= 20).length}
                    </div>
                    <p className="text-xs text-orange-600/70">SoC below 20%</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Commands Tab */}
          <TabsContent value="commands" className="space-y-4">
            <Card className="shadow-xl border-0 bg-gradient-to-br from-card to-card/95 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  ⚡ Send Command
                </CardTitle>
                <CardDescription className="text-base">Configure and send commands to your fleet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-foreground mb-3">🎯 Command Templates</h3>
                  <div className="flex flex-wrap gap-3">
                    {commandTemplates.map((template, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => loadCommandTemplate(template)}
                        className="bg-white text-foreground border-2 border-border hover:bg-muted hover:border-muted-foreground transition-all duration-200 transform hover:scale-105"
                      >
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleCommandSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="command" className="text-sm font-semibold">
                      Command
                    </Label>
                    <Input
                      id="command"
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="Enter command (e.g., set_wifi, kill_device)"
                      className="bg-white border-2 border-border"
                      required
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Parameters</Label>
                      {params.length < 10 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddParam}
                          className="bg-white text-foreground border-2 border-border hover:bg-muted hover:border-muted-foreground transition-all duration-200 transform hover:scale-105"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Parameter
                        </Button>
                      )}
                    </div>

                    {params.length > 0 ? (
                      <div className="space-y-3 border-2 border-border rounded-lg p-4 bg-muted/20">
                        {params.map((param, index) => (
                          <div key={index} className="flex items-center space-x-3">
                            <Input
                              type="text"
                              value={param.key}
                              onChange={(e) => handleParamChange(index, "key", e.target.value)}
                              placeholder="Key"
                              className="flex-1 bg-white border-2 border-border"
                              required
                            />
                            <Input
                              type="text"
                              value={param.value}
                              onChange={(e) => handleParamChange(index, "value", e.target.value)}
                              placeholder="Value"
                              className="flex-1 bg-white border-2 border-border"
                              required
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveParam(index)}
                              className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 border-2 border-transparent hover:border-destructive/20 transition-all duration-200 transform hover:scale-110"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center p-6 border-2 border-dashed border-border rounded-lg bg-muted/10">
                        <p className="text-sm text-muted-foreground mb-2">No parameters added yet.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddParam}
                          className="bg-white text-foreground border-2 border-border hover:bg-muted hover:border-muted-foreground transition-all duration-200 transform hover:scale-105"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Parameter
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col space-y-4">
                    <Button
                      type="submit"
                      disabled={commandLoading || !command}
                      className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 text-primary-foreground hover:from-primary/90 hover:to-primary shadow-lg transition-all duration-200 transform hover:scale-105 border-2 border-primary"
                    >
                      {commandLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Command
                        </>
                      )}
                    </Button>

                    {commandSuccess && (
                      <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-900/50">
                        <p className="text-green-600 dark:text-green-400 font-medium">{commandSuccess}</p>
                      </div>
                    )}

                    {error && (
                      <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-900/50">
                        <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
                      </div>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 bg-gradient-to-br from-card to-card/95 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">📋 Available Commands</CardTitle>
                <CardDescription>Common commands for device management</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border-2 border-border overflow-hidden shadow-inner">
                  <div className="grid grid-cols-3 p-4 border-b-2 border-border bg-gradient-to-r from-muted to-muted/80">
                    <div className="font-bold text-sm">Command</div>
                    <div className="font-bold text-sm">Description</div>
                    <div className="font-bold text-sm">Parameters</div>
                  </div>
                  <div className="divide-y-2 divide-border">
                    <div className="grid grid-cols-3 p-4 hover:bg-muted/30 transition-colors">
                      <div className="font-medium text-sm">set_wifi</div>
                      <div className="text-sm text-muted-foreground">Configure WiFi connection</div>
                      <div className="text-sm text-muted-foreground">ssid, password</div>
                    </div>
                    <div className="grid grid-cols-3 p-4 hover:bg-muted/30 transition-colors">
                      <div className="font-medium text-sm">kill_device</div>
                      <div className="text-sm text-muted-foreground">Deactivate device immediately</div>
                      <div className="text-sm text-muted-foreground">device_id</div>
                    </div>
                    <div className="grid grid-cols-3 p-4 hover:bg-muted/30 transition-colors">
                      <div className="font-medium text-sm">set_current_sensor</div>
                      <div className="text-sm text-muted-foreground">Configure current sensor type</div>
                      <div className="text-sm text-muted-foreground">type (fluxgate/clip-on), range (1x/2x/4x)</div>
                    </div>
                    <div className="grid grid-cols-3 p-4 hover:bg-muted/30 transition-colors">
                      <div className="font-medium text-sm">set_voltage_range</div>
                      <div className="text-sm text-muted-foreground">Configure voltage sensor range</div>
                      <div className="text-sm text-muted-foreground">range (1x/2x/4x)</div>
                    </div>
                    <div className="grid grid-cols-3 p-4 hover:bg-muted/30 transition-colors">
                      <div className="font-medium text-sm">set_lte_config</div>
                      <div className="text-sm text-muted-foreground">Configure LTE connection</div>
                      <div className="text-sm text-muted-foreground">apn, username, password</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  )
}
