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
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { ChevronDown, ChevronRight } from "lucide-react"


ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const VehicleMap = dynamic(() => import("./components/VehicleMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px] bg-gray-100">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
const [startDate, setStartDate] = useState<Date | null>(null);
const [endDate, setEndDate] = useState<Date | null>(null);
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
      <div className="space-y-8">

        <div className="mb-4 flex justify-end">
          <Button
            size="sm"
            onClick={() => auth.signoutRedirect()}
            className="bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded"
          >
            Logout
          </Button>
        </div>
        {/* Hero Header */}
        <div className="text-center py-8 bg-blue-700 rounded-2xl shadow-2xl">
          <h1 className="text-5xl font-bold text-white mb-2">Fleet Command Center</h1>
          <p className="text-xl text-blue-100">Real-time monitoring and control for your connected vehicles</p>
        </div>

        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Dashboard</h2>
        </div>
      </div>

      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-3 p-0 rounded-xl bg-transparent gap-2">
            <TabsTrigger
              value="chart"
              className="rounded-lg px-2 py-3 text-sm font-semibold transition-all duration-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:scale-100 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Chart View
            </TabsTrigger>
            <TabsTrigger
              value="map"
              className="rounded-lg px-2 py-3 text-sm font-semibold transition-all duration-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:scale-100 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Map View
            </TabsTrigger>
            <TabsTrigger
              value="commands"
              className="rounded-lg px-2 py-3 text-sm font-semibold transition-all duration-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:scale-100 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Commands
            </TabsTrigger>
          </TabsList>

          {/* Chart View Tab */}
          <TabsContent value="chart" className="space-y-6">
            <Card className="shadow-xl border-2 border-gray-200 dark:border-gray-700 bg-transparent">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl text-blue-600 dark:text-blue-400">Data Visualization</CardTitle>
                <CardDescription className="text-base text-gray-600 dark:text-gray-400">
                  Configure your chart settings
                </CardDescription>
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
                          ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                          : "bg-white text-blue-700 border-blue-300 hover:border-blue-500 hover:bg-blue-50 dark:bg-gray-700 dark:text-blue-400 dark:border-blue-500 dark:hover:bg-gray-600"
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
                          ? "bg-green-600 text-white border-green-600 shadow-lg"
                          : "bg-white text-green-700 border-green-300 hover:border-green-500 hover:bg-green-50 dark:bg-gray-700 dark:text-green-400 dark:border-green-500 dark:hover:bg-gray-600"
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
                          ? "bg-purple-600 text-white border-purple-600 shadow-lg"
                          : "bg-white text-purple-700 border-purple-300 hover:border-purple-500 hover:bg-purple-50 dark:bg-gray-700 dark:text-purple-400 dark:border-purple-500 dark:hover:bg-gray-600"
                      }
                    `}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Data Fields
                  </Button>
                </div>

                {/* Time Range Section */}
                {showTimeRange && (
                  <div className="p-6 rounded-xl bg-blue-50 dark:bg-blue-900/20 shadow-lg">
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-4">Select Time Range</h3>
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
                                ? "bg-blue-700 text-white border-blue-700 shadow-md"
                                : "bg-white text-blue-700 border-blue-300 hover:border-blue-500 hover:bg-blue-100 dark:bg-gray-700 dark:text-blue-400 dark:border-blue-500 dark:hover:bg-gray-600"
                            }
                          `}
                        >
                          {r.label}
                        </Button>
                      ))}
                    </div>

                    {/* Custom Date Range */}
                    {timeRange === "custom" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-blue-800 dark:text-blue-300">Start Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0 bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-600 shadow-xl z-50"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={startDate ?? undefined}
                                onSelect={(selected) => setStartDate(selected ?? null)}
                                required={false}
                                className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-0"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-blue-800 dark:text-blue-300">End Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0 bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-600 shadow-xl z-50"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={endDate ?? undefined}
                                onSelect={(selected) => setEndDate(selected ?? null)}
                                required={false}
                                className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-0"
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
                  <div className="p-6 rounded-xl bg-green-50 dark:bg-green-900/20 shadow-lg">
                    <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-4">Choose Devices</h3>
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
                                ? "bg-green-700 text-white border-green-700 shadow-md"
                                : "bg-white text-green-700 border-green-300 hover:border-green-500 hover:bg-green-100 dark:bg-gray-700 dark:text-green-400 dark:border-green-500 dark:hover:bg-gray-600"
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
                  <div className="p-6 rounded-xl bg-purple-50 dark:bg-purple-900/20 shadow-lg">
                    <h3 className="text-lg font-bold text-purple-800 dark:text-purple-300 mb-4">Select Data Fields</h3>
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
                                ? "bg-purple-700 text-white border-purple-700 shadow-md"
                                : "bg-white text-purple-700 border-purple-300 hover:border-purple-500 hover:bg-purple-100 dark:bg-gray-700 dark:text-purple-400 dark:border-purple-500 dark:hover:bg-gray-600"
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
            <Card className="shadow-xl border-2 border-gray-200 dark:border-gray-700 bg-transparent">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-2xl text-blue-600 dark:text-blue-400">Vehicle Locations</CardTitle>
                  <CardDescription className="text-base text-gray-600 dark:text-gray-400">
                    Real-time positions of {latestData.length} vehicles
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="autoRefresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                    <Label htmlFor="autoRefresh" className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
                        className="w-16 h-8 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">sec</span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchLatestData}
                    disabled={loading}
                    className="bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 transform hover:scale-105"
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
                <div className="h-[500px] w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 overflow-hidden bg-gray-100 dark:bg-gray-700 shadow-inner">
                  <VehicleMap devices={latestData} />
                </div>
              </CardContent>
            </Card>

            {latestData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="shadow-lg border-2 border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                      Total Vehicles
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{latestData.length}</div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Active in fleet</p>
                  </CardContent>
                </Card>

                <Card className="shadow-lg border-2 border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-green-800 dark:text-green-300">
                      Good Battery
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {latestData.filter((d) => d.soc > 20).length}
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400">SoC above 20%</p>
                  </CardContent>
                </Card>

                <Card className="shadow-lg border-2 border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                      Low Battery
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                      {latestData.filter((d) => d.soc <= 20).length}
                    </div>
                    <p className="text-xs text-orange-600 dark:text-orange-400">SoC below 20%</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Commands Tab */}
          <TabsContent value="commands" className="space-y-4">
            <Card className="shadow-xl border-2 border-gray-200 dark:border-gray-700 bg-transparent">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl text-blue-600 dark:text-blue-400">Send Command</CardTitle>
                <CardDescription className="text-base text-gray-600 dark:text-gray-400">
                  Configure and send commands to your fleet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Command Templates</h3>
                  <div className="flex flex-wrap gap-3">
                    {commandTemplates.map((template, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => loadCommandTemplate(template)}
                        className={`
                          bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 transform hover:scale-105
                          ${
                            command === template.command
                              ? "bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300"
                              : "text-gray-700 dark:text-gray-300"
                          }
                        `}
                      >
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleCommandSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="command" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Command
                    </Label>
                    <Input
                      id="command"
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="Enter command (e.g., set_wifi, kill_device)"
                      className="bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-gray-900 dark:text-gray-100">Parameters</Label>
                      {params.length < 10 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddParam}
                          className="bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 transform hover:scale-105"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Parameter
                        </Button>
                      )}
                    </div>

                    {params.length > 0 ? (
                      <div className="space-y-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                        {params.map((param, index) => (
                          <div key={index} className="flex items-center space-x-3">
                            <Input
                              type="text"
                              value={param.key}
                              onChange={(e) => handleParamChange(index, "key", e.target.value)}
                              placeholder="Key"
                              className="flex-1 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                              required
                            />
                            <Input
                              type="text"
                              value={param.value}
                              onChange={(e) => handleParamChange(index, "value", e.target.value)}
                              placeholder="Value"
                              className="flex-1 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                              required
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveParam(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-2 border-transparent hover:border-red-200 dark:hover:border-red-800 transition-all duration-200 transform hover:scale-110"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddParam}
                          className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 transform hover:scale-105"
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
                      className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700 shadow-lg transition-all duration-200 transform hover:scale-105 border-2 border-blue-600"
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
                      <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700">
                        <p className="text-green-700 dark:text-green-300 font-medium">{commandSuccess}</p>
                      </div>
                    )}

                    {error && (
                      <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700">
                        <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
                      </div>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

<Accordion type="single" collapsible className="w-full bg-white border border-gray-200 rounded-lg shadow">
  <AccordionItem value="commands">
    
    <AccordionTrigger className="flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-900">
      Available Commands
    </AccordionTrigger>
    <AccordionContent className="px-0 pt-0 pb-4">
      {/* Header row */}
      <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="font-semibold text-sm text-gray-900">Command</div>
        <div className="font-semibold text-sm text-gray-900">Description</div>
        <div className="font-semibold text-sm text-gray-900">Parameters</div>
      </div>
      {/* Rows */}
      <div className="divide-y divide-gray-200">
        {commandTemplates.map((tpl) => {
          // derive bracketed values for known commands
          let paramDisplay = "";
          if (tpl.command === "set_current_sensor") {
            paramDisplay = "type [fluxgate, clip-on], range [1x, 2x, 4x]";
          } else if (tpl.command === "set_voltage_range") {
            paramDisplay = "range [1x, 2x, 4x]";
          } else if (tpl.command === "set_wifi") {
            paramDisplay = "ssid, password";
          } else if (tpl.command === "kill_device") {
            paramDisplay = "device_id";
          } else if (tpl.command === "set_lte_config") {
            paramDisplay = "apn, username, password";
          } else {
            // fallback: list keys without brackets
            paramDisplay = tpl.params.map(p => p.key).join(", ");
          }

          return (
            <div
              key={tpl.command}
              className="grid grid-cols-3 gap-2 px-4 py-2 hover:bg-gray-100 transition-colors"
            >
              <div className="text-sm text-gray-900">{tpl.command}</div>
              <div className="text-sm text-gray-700">{tpl.name}</div>
              <div className="text-sm text-gray-700">{paramDisplay}</div>
            </div>
          )
        })}
      </div>
    </AccordionContent>
  </AccordionItem>
</Accordion>

          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  )
}
