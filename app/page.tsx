"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon, RefreshCw, Plus, Trash, Loader2, Send, Settings, Filter, Clock, Download, MapPin, Activity, Zap } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import DataChart1 from "./components/DataChart1"
import dynamic from "next/dynamic"
import type { ApiDataItem } from "./components/DataChart1"
import type { DeviceData } from "./components/VehicleMap"
import type { RawDataItem, DownsampleOptions } from "@/lib/data-processor"
import { downsampleData } from "@/lib/data-processor"
import { config } from "@/lib/config"
import DashboardLayout from "./components/dashboard-layout"
import { useRouter } from "next/navigation"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

const VehicleMap = dynamic(() => import("./components/VehicleMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
  const [rawData, setRawData] = useState<RawDataItem[]>([])
  const [downsampledData, setDownsampledData] = useState<ApiDataItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [chartFields, setChartFields] = useState<string[]>(["voltage_v"])
  const [selectedDevices, setSelectedDevices] = useState<string[]>(["all"])
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>("1m")
  const [command, setCommand] = useState("")
  const [params, setParams] = useState<ParamItem[]>([])
  const [commandLoading, setCommandLoading] = useState(false)
  const [commandSuccess, setCommandSuccess] = useState("")
  const [latestData, setLatestData] = useState<DeviceData[]>([])
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(5)
  const [downsampleOptions, setDownsampleOptions] = useState<DownsampleOptions>({
    targetPoints: 100,
    method: 'average'
  })

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

  // Fetch raw data when date range changes
  useEffect(() => {
    if (!auth.isAuthenticated || !startDate || !endDate) return

    setLoading(true)
    setError("")

    const startIso = startDate.toISOString().split(".")[0] + "Z"
    const endIso = endDate.toISOString().split(".")[0] + "Z"

    const params = new URLSearchParams({
      start: startIso,
      end: endIso,
    })

    // Fetch raw data instead of downsampled data
    fetch(`${config.api.rawData}?${params}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Raw data API ${res.status}: ${await res.text()}`)
        }
        return res.json()
      })
      .then((json) => {
        const rawDataArray = Array.isArray(json) ? json : []
        setRawData(rawDataArray)
        
        // Downsample the raw data for chart display
        if (rawDataArray.length > 0) {
          const downsampled = downsampleData(rawDataArray, downsampleOptions)
          setDownsampledData(downsampled)
        } else {
          setDownsampledData([])
        }
      })
      .catch((err) => {
        console.error(err)
        setError(err.message)
        setRawData([])
        setDownsampledData([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [auth.isAuthenticated, startDate, endDate, downsampleOptions])

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

  // Filter downsampled data for display
  const filteredData = downsampledData.filter((item) => {
    if (!selectedDevices.includes("all") && !selectedDevices.includes(item.deviceID)) {
      return false
    }
    return true
  })

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

  const router = useRouter()

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight mb-2">Telematics Hub</h1>
                <p className="text-xl text-blue-100 max-w-2xl">
                  Advanced fleet monitoring and control platform with real-time analytics and command execution
                </p>
              </div>
              <div className="hidden md:flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-2xl font-bold">{latestData.length}</div>
                  <div className="text-sm text-blue-200">Active Devices</div>
                </div>
                <div className="w-px h-12 bg-blue-700"></div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{rawData.length}</div>
                  <div className="text-sm text-blue-200">Data Points</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <TabsTrigger 
              value="chart" 
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm"
            >
              <Activity className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="map" 
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Map View
            </TabsTrigger>
            <TabsTrigger 
              value="commands" 
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm"
            >
              <Zap className="w-4 h-4 mr-2" />
              Commands
            </TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="chart" className="space-y-6">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Data Analytics
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Configure visualization settings and view real-time data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Control Panel */}
                <Accordion type="multiple" className="space-y-4">
                  {/* Time Range */}
                  <AccordionItem value="time-range" className="border border-slate-200 dark:border-slate-700 rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="font-medium">Time Range</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {timeRanges.map((r) => (
                            <Button
                              key={r.value}
                              variant={timeRange === r.value ? "default" : "outline"}
                              size="sm"
                              onClick={() => setTimeRange(r.value)}
                            >
                              {r.label}
                            </Button>
                          ))}
                        </div>
                        {timeRange === "custom" && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Start Date</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={startDate ?? undefined}
                                    onSelect={setStartDate}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="space-y-2">
                              <Label>End Date</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={endDate ?? undefined}
                                    onSelect={setEndDate}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Device Filter */}
                  <AccordionItem value="device-filter" className="border border-slate-200 dark:border-slate-700 rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center space-x-2">
                        <Filter className="w-4 h-4 text-green-600" />
                        <span className="font-medium">Device Filter</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="flex flex-wrap gap-2">
                        {["all", ...new Set(rawData.map((d) => d.deviceID))].map((dev) => (
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
                          >
                            {dev}
                          </Button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Data Fields */}
                  <AccordionItem value="data-fields" className="border border-slate-200 dark:border-slate-700 rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center space-x-2">
                        <Settings className="w-4 h-4 text-purple-600" />
                        <span className="font-medium">Data Fields</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {allFields.map((field) => (
                            <Button
                              key={field}
                              variant={chartFields.includes(field) ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setChartFields((prev) =>
                                  prev.includes(field)
                                    ? prev.filter((f) => f !== field)
                                    : [...prev, field]
                                )
                              }}
                            >
                              {field}
                            </Button>
                          ))}
                        </div>
                        <div className="flex items-center space-x-4">
                          <Label htmlFor="downsample-points">Chart Points:</Label>
                          <Input
                            id="downsample-points"
                            type="number"
                            min="10"
                            max="1000"
                            value={downsampleOptions.targetPoints}
                            onChange={(e) => setDownsampleOptions(prev => ({
                              ...prev,
                              targetPoints: parseInt(e.target.value) || 100
                            }))}
                            className="w-24"
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Chart Display */}
                <div className="mt-8">
                  <DataChart1 
                    data={filteredData} 
                    chartFields={chartFields} 
                    loading={loading}
                    rawData={rawData}
                  />
                </div>

                {error && (
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Map Tab */}
          <TabsContent value="map" className="space-y-6">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Fleet Map
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Real-time location tracking and fleet overview
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[600px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  <VehicleMap devices={latestData} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commands Tab */}
          <TabsContent value="commands" className="space-y-6">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Device Commands
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Send commands to your fleet devices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Command Templates */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Quick Commands</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {commandTemplates.map((template, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        onClick={() => loadCommandTemplate(template)}
                        className="h-auto p-4 flex flex-col items-start space-y-2 text-left"
                      >
                        <span className="font-medium">{template.name}</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {template.command}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Command Form */}
                <form onSubmit={handleCommandSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="command">Command</Label>
                    <Input
                      id="command"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="Enter command..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Parameters</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddParam}
                        disabled={params.length >= 10}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Parameter
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {params.map((param, index) => (
                        <div key={index} className="flex space-x-2">
                          <Input
                            placeholder="Key"
                            value={param.key}
                            onChange={(e) => handleParamChange(index, "key", e.target.value)}
                            className="flex-1"
                          />
                          <Input
                            placeholder="Value"
                            value={param.value}
                            onChange={(e) => handleParamChange(index, "value", e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveParam(index)}
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button type="submit" disabled={commandLoading} className="w-full">
                    {commandLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending Command...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Command
                      </>
                    )}
                  </Button>
                </form>

                {commandSuccess && (
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <p className="text-green-600 dark:text-green-400">{commandSuccess}</p>
                  </div>
                )}

                {error && (
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
} 