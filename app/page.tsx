"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon, RefreshCw, Plus, Trash, Loader2, Send } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

const VehicleMap = dynamic(() => import("./components/VehicleMap"), { ssr: false })

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

// Predefined command templates
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
    name: "Deactivate Device",
    command: "deactivate",
    params: [
      { key: "device_id", value: "" },
      { key: "reason", value: "maintenance" },
    ],
  },
  {
    name: "Set Current Sensor",
    command: "set_sensor",
    params: [
      { key: "type", value: "fluxgate" }, // or "clip-on"
      { key: "calibration", value: "auto" },
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

  // New state for field category selection
  const [fieldCategory, setFieldCategory] = useState<string>("voltage")

  // Group fields by category
  const fieldCategories = {
    voltage: ["voltage_v"],
    temperature: ["temperature_c"],
    speed: ["speed", "speed_kmh"],
    position: ["lat", "lon", "alt_m", "heading_deg"],
    quality: ["quality_min", "quality_avg"],
    current: ["min", "avg", "max"],
    signal: ["signal_strength_dbm"],
    acceleration: ["accel_x", "accel_y", "accel_z"],
    power: ["power_kw"],
  }

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

  // Get current category fields
  const currentCategoryFields = fieldCategories[fieldCategory as keyof typeof fieldCategories] || []

  return (
    <PageLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Monitor your fleet and analyze telemetry data</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted text-muted-foreground">
            <TabsTrigger
              value="chart"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              Chart View
            </TabsTrigger>
            <TabsTrigger value="map" className="data-[state=active]:bg-background data-[state=active]:text-foreground">
              Map View
            </TabsTrigger>
            <TabsTrigger
              value="commands"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              Commands
            </TabsTrigger>
          </TabsList>

          {/* Chart View Tab */}
          <TabsContent value="chart" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Visualization</CardTitle>
                <CardDescription>View and analyze telemetry data from your devices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Time Range Selector */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Time Range</h3>
                  <div className="flex flex-wrap gap-2">
                    {timeRanges.map((r) => (
                      <Button
                        key={r.value}
                        variant={timeRange === r.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeRange(r.value)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 data-[state=active]:bg-primary/90"
                      >
                        {r.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Custom Date Range */}
                {timeRange === "custom" && (
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Start Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-background border">
                          <Calendar
                            mode="single"
                            selected={startDate || undefined}
                            onSelect={setStartDate}
                            initialFocus
                            className="bg-background text-foreground"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">End Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-background border">
                          <Calendar
                            mode="single"
                            selected={endDate || undefined}
                            onSelect={setEndDate}
                            initialFocus
                            className="bg-background text-foreground"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}

                {/* Device Filter */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Device Filter</h3>
                  <div className="flex flex-wrap gap-2">
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
                        className="bg-primary text-primary-foreground hover:bg-primary/90 data-[state=active]:bg-primary/90"
                      >
                        {dev}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Field Category Selector */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Data Field Category</h3>
                  <Select value={fieldCategory} onValueChange={setFieldCategory}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="voltage">Voltage</SelectItem>
                      <SelectItem value="temperature">Temperature</SelectItem>
                      <SelectItem value="speed">Speed</SelectItem>
                      <SelectItem value="position">Position</SelectItem>
                      <SelectItem value="quality">Quality</SelectItem>
                      <SelectItem value="current">Current</SelectItem>
                      <SelectItem value="signal">Signal</SelectItem>
                      <SelectItem value="acceleration">Acceleration</SelectItem>
                      <SelectItem value="power">Power</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Field Selector for Current Category */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Data Fields</h3>
                  <div className="flex flex-wrap gap-2">
                    {currentCategoryFields.map((f) => (
                      <Button
                        key={f}
                        variant={chartFields.includes(f) ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setChartFields((cf) => (cf.includes(f) ? cf.filter((x) => x !== f) : [...cf, f]))
                        }
                        className="bg-primary text-primary-foreground hover:bg-primary/90 data-[state=active]:bg-primary/90"
                      >
                        {f}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Chart */}
                <div className="pt-4">
                  <DataChart1 data={filteredApiData} chartFields={chartFields} loading={loading} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Map View Tab */}
          <TabsContent value="map" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Vehicle Locations</CardTitle>
                  <CardDescription>Real-time positions of {latestData.length} vehicles</CardDescription>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="autoRefresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                    <Label htmlFor="autoRefresh">Auto Refresh</Label>
                  </div>
                  {autoRefresh && (
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={refreshIntervalSec}
                        onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
                        min={1}
                        className="w-16"
                      />
                      <span className="text-sm text-muted-foreground">sec</span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchLatestData}
                    disabled={loading}
                    className="bg-background text-foreground hover:bg-muted"
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
                <div className="h-[500px] w-full rounded-md border overflow-hidden">
                  {loading && latestData.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="mt-4 text-muted-foreground">Loading vehicle locations...</p>
                      </div>
                    </div>
                  ) : (
                    <VehicleMap devices={latestData} />
                  )}
                </div>
              </CardContent>
            </Card>

            {latestData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Vehicles</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{latestData.length}</div>
                    <p className="text-xs text-muted-foreground">Active in fleet</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Good Battery</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-500">
                      {latestData.filter((d) => d.soc > 20).length}
                    </div>
                    <p className="text-xs text-muted-foreground">SoC above 20%</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Low Battery</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-500">
                      {latestData.filter((d) => d.soc <= 20).length}
                    </div>
                    <p className="text-xs text-muted-foreground">SoC below 20%</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Commands Tab */}
          <TabsContent value="commands" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Send Command</CardTitle>
                <CardDescription>Configure and send commands to your fleet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2">Command Templates</h3>
                  <div className="flex flex-wrap gap-2">
                    {commandTemplates.map((template, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => loadCommandTemplate(template)}
                        className="bg-background text-foreground hover:bg-muted"
                      >
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleCommandSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="command">Command</Label>
                    <Input
                      id="command"
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="Enter command (e.g., set_wifi, deactivate)"
                      required
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Parameters</Label>
                      {params.length < 10 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddParam}
                          className="bg-background text-foreground hover:bg-muted"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Parameter
                        </Button>
                      )}
                    </div>

                    {params.length > 0 ? (
                      <div className="space-y-3 border rounded-md p-4">
                        {params.map((param, index) => (
                          <div key={index} className="flex items-center space-x-3">
                            <Input
                              type="text"
                              value={param.key}
                              onChange={(e) => handleParamChange(index, "key", e.target.value)}
                              placeholder="Key"
                              className="flex-1"
                              required
                            />
                            <Input
                              type="text"
                              value={param.value}
                              onChange={(e) => handleParamChange(index, "value", e.target.value)}
                              placeholder="Value"
                              className="flex-1"
                              required
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveParam(index)}
                              className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center p-6 border border-dashed rounded-md">
                        <p className="text-sm text-muted-foreground">No parameters added yet.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddParam}
                          className="mt-2 bg-background text-foreground hover:bg-muted"
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
                      className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
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
                      <div className="p-4 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50">
                        <p className="text-green-600 dark:text-green-400">{commandSuccess}</p>
                      </div>
                    )}

                    {error && (
                      <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50">
                        <p className="text-red-600 dark:text-red-400">{error}</p>
                      </div>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available Commands</CardTitle>
                <CardDescription>Common commands for device management</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <div className="grid grid-cols-3 p-3 border-b bg-muted/50">
                    <div className="font-medium">Command</div>
                    <div className="font-medium">Description</div>
                    <div className="font-medium">Parameters</div>
                  </div>
                  <div className="divide-y">
                    <div className="grid grid-cols-3 p-3">
                      <div className="font-medium">set_wifi</div>
                      <div className="text-sm">Configure WiFi connection</div>
                      <div className="text-sm text-muted-foreground">ssid, password</div>
                    </div>
                    <div className="grid grid-cols-3 p-3">
                      <div className="font-medium">deactivate</div>
                      <div className="text-sm">Deactivate device temporarily</div>
                      <div className="text-sm text-muted-foreground">device_id, reason</div>
                    </div>
                    <div className="grid grid-cols-3 p-3">
                      <div className="font-medium">set_sensor</div>
                      <div className="text-sm">Configure current sensor type</div>
                      <div className="text-sm text-muted-foreground">type (fluxgate/clip-on), calibration</div>
                    </div>
                    <div className="grid grid-cols-3 p-3">
                      <div className="font-medium">update_firmware</div>
                      <div className="text-sm">Update device firmware</div>
                      <div className="text-sm text-muted-foreground">version, force</div>
                    </div>
                    <div className="grid grid-cols-3 p-3">
                      <div className="font-medium">set_reporting</div>
                      <div className="text-sm">Configure reporting interval</div>
                      <div className="text-sm text-muted-foreground">interval_sec, priority</div>
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
