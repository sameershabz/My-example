"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon, RefreshCw, Plus, Trash, Loader2, Send, ChevronRight, ChevronLeft } from "lucide-react"
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

  // Step-by-step control state
  const [currentStep, setCurrentStep] = useState<"timeRange" | "devices" | "category" | "fields">("timeRange")
  const [activeCategory, setActiveCategory] = useState<string>("voltage")

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

  // Get current category fields
  const currentCategoryFields = fieldCategories[activeCategory as keyof typeof fieldCategories] || []

  // Navigation helpers
  const goToNextStep = () => {
    if (currentStep === "timeRange") setCurrentStep("devices")
    else if (currentStep === "devices") setCurrentStep("category")
    else if (currentStep === "category") setCurrentStep("fields")
  }

  const goToPrevStep = () => {
    if (currentStep === "fields") setCurrentStep("category")
    else if (currentStep === "category") setCurrentStep("devices")
    else if (currentStep === "devices") setCurrentStep("timeRange")
  }

  return (
    <PageLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Monitor your fleet and analyze telemetry data</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-muted p-1 rounded-lg border border-border">
            <TabsTrigger
              value="chart"
              className="rounded-md px-3 py-2 text-sm font-medium transition-all border border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-border"
            >
              Chart View
            </TabsTrigger>
            <TabsTrigger
              value="map"
              className="rounded-md px-3 py-2 text-sm font-medium transition-all border border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-border"
            >
              Map View
            </TabsTrigger>
            <TabsTrigger
              value="commands"
              className="rounded-md px-3 py-2 text-sm font-medium transition-all border border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-border"
            >
              Commands
            </TabsTrigger>
          </TabsList>

          {/* Chart View Tab */}
          <TabsContent value="chart" className="space-y-4">
            <Card className="shadow-lg border border-border bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Data Visualization</CardTitle>
                <CardDescription>Configure your chart settings step by step</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Step Navigation */}
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPrevStep}
                    disabled={currentStep === "timeRange"}
                    className="border-border bg-background hover:bg-muted"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>

                  <div className="text-sm font-medium text-center">
                    Step{" "}
                    {currentStep === "timeRange"
                      ? "1"
                      : currentStep === "devices"
                        ? "2"
                        : currentStep === "category"
                          ? "3"
                          : "4"}{" "}
                    of 4: {currentStep === "timeRange" && "Select Time Range"}
                    {currentStep === "devices" && "Choose Devices"}
                    {currentStep === "category" && "Pick Data Category"}
                    {currentStep === "fields" && "Select Fields"}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextStep}
                    disabled={currentStep === "fields"}
                    className="border-border bg-background hover:bg-muted"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {/* Step 1: Time Range Selector */}
                {currentStep === "timeRange" && (
                  <div className="space-y-4 p-4 border border-border rounded-lg bg-background">
                    <h3 className="text-lg font-semibold text-foreground">Select Time Range</h3>
                    <div className="flex flex-wrap gap-2">
                      {timeRanges.map((r) => (
                        <Button
                          key={r.value}
                          variant={timeRange === r.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setTimeRange(r.value)}
                          className={`
                            transition-all duration-200 font-medium border-2
                            ${
                              timeRange === r.value
                                ? "bg-primary text-primary-foreground border-primary shadow-md hover:bg-primary/90"
                                : "bg-background text-foreground border-border hover:bg-muted hover:border-muted-foreground"
                            }
                          `}
                        >
                          {r.label}
                        </Button>
                      ))}
                    </div>

                    {/* Custom Date Range */}
                    {timeRange === "custom" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border mt-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Start Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal bg-background border-2 border-border hover:bg-muted"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0 bg-background border-2 border-border shadow-lg z-50"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={startDate || undefined}
                                onSelect={setStartDate}
                                initialFocus
                                className="bg-background text-foreground border-0"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">End Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal bg-background border-2 border-border hover:bg-muted"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0 bg-background border-2 border-border shadow-lg z-50"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={endDate || undefined}
                                onSelect={setEndDate}
                                initialFocus
                                className="bg-background text-foreground border-0"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Device Filter */}
                {currentStep === "devices" && (
                  <div className="space-y-4 p-4 border border-border rounded-lg bg-background">
                    <h3 className="text-lg font-semibold text-foreground">Choose Devices</h3>
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
                          className={`
                            transition-all duration-200 font-medium border-2
                            ${
                              selectedDevices.includes(dev)
                                ? "bg-primary text-primary-foreground border-primary shadow-md hover:bg-primary/90"
                                : "bg-background text-foreground border-border hover:bg-muted hover:border-muted-foreground"
                            }
                          `}
                        >
                          {dev}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 3: Category Selector */}
                {currentStep === "category" && (
                  <div className="space-y-4 p-4 border border-border rounded-lg bg-background">
                    <h3 className="text-lg font-semibold text-foreground">Pick Data Category</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(fieldCategories).map((category) => (
                        <Button
                          key={category}
                          variant={activeCategory === category ? "default" : "outline"}
                          size="sm"
                          onClick={() => setActiveCategory(category)}
                          className={`
                            transition-all duration-200 font-medium capitalize border-2
                            ${
                              activeCategory === category
                                ? "bg-primary text-primary-foreground border-primary shadow-md hover:bg-primary/90"
                                : "bg-background text-foreground border-border hover:bg-muted hover:border-muted-foreground"
                            }
                          `}
                        >
                          {category}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 4: Field Selector */}
                {currentStep === "fields" && (
                  <div className="space-y-4 p-4 border border-border rounded-lg bg-background">
                    <h3 className="text-lg font-semibold text-foreground">
                      Select {activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Fields
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {currentCategoryFields.map((f) => (
                        <Button
                          key={f}
                          variant={chartFields.includes(f) ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setChartFields((cf) => (cf.includes(f) ? cf.filter((x) => x !== f) : [...cf, f]))
                          }
                          className={`
                            transition-all duration-200 font-medium border-2
                            ${
                              chartFields.includes(f)
                                ? "bg-primary text-primary-foreground border-primary shadow-md hover:bg-primary/90"
                                : "bg-background text-foreground border-border hover:bg-muted hover:border-muted-foreground"
                            }
                          `}
                        >
                          {f}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chart */}
                <div className="pt-4">
                  <DataChart1 data={filteredApiData} chartFields={chartFields} loading={loading} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Map View Tab */}
          <TabsContent value="map" className="space-y-4">
            <Card className="shadow-lg border border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-xl">Vehicle Locations</CardTitle>
                  <CardDescription>Real-time positions of {latestData.length} vehicles</CardDescription>
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
                        className="w-16 h-8 border-border"
                      />
                      <span className="text-sm text-muted-foreground">sec</span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchLatestData}
                    disabled={loading}
                    className="bg-background text-foreground border-2 border-border hover:bg-muted hover:border-muted-foreground"
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
                <div className="h-[500px] w-full rounded-lg border-2 border-border overflow-hidden bg-muted/10">
                  <VehicleMap devices={latestData} />
                </div>
              </CardContent>
            </Card>

            {latestData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="shadow-lg border border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{latestData.length}</div>
                    <p className="text-xs text-muted-foreground">Active in fleet</p>
                  </CardContent>
                </Card>

                <Card className="shadow-lg border border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Good Battery</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-500">
                      {latestData.filter((d) => d.soc > 20).length}
                    </div>
                    <p className="text-xs text-muted-foreground">SoC above 20%</p>
                  </CardContent>
                </Card>

                <Card className="shadow-lg border border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Low Battery</CardTitle>
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
            <Card className="shadow-lg border border-border bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Send Command</CardTitle>
                <CardDescription>Configure and send commands to your fleet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Command Templates</h3>
                  <div className="flex flex-wrap gap-2">
                    {commandTemplates.map((template, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => loadCommandTemplate(template)}
                        className="bg-background text-foreground border-2 border-border hover:bg-muted hover:border-muted-foreground transition-all duration-200"
                      >
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleCommandSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="command" className="text-sm font-medium">
                      Command
                    </Label>
                    <Input
                      id="command"
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="Enter command (e.g., set_wifi, kill_device)"
                      className="bg-background border-2 border-border"
                      required
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Parameters</Label>
                      {params.length < 10 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddParam}
                          className="bg-background text-foreground border-2 border-border hover:bg-muted hover:border-muted-foreground"
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
                              className="flex-1 bg-background border-2 border-border"
                              required
                            />
                            <Input
                              type="text"
                              value={param.value}
                              onChange={(e) => handleParamChange(index, "value", e.target.value)}
                              placeholder="Value"
                              className="flex-1 bg-background border-2 border-border"
                              required
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveParam(index)}
                              className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 border-2 border-transparent hover:border-destructive/20"
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
                          className="bg-background text-foreground border-2 border-border hover:bg-muted hover:border-muted-foreground"
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
                      className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all duration-200 border-2 border-primary"
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

            <Card className="shadow-lg border border-border bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Available Commands</CardTitle>
                <CardDescription>Common commands for device management</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border-2 border-border overflow-hidden">
                  <div className="grid grid-cols-3 p-4 border-b-2 border-border bg-muted/50">
                    <div className="font-semibold text-sm">Command</div>
                    <div className="font-semibold text-sm">Description</div>
                    <div className="font-semibold text-sm">Parameters</div>
                  </div>
                  <div className="divide-y-2 divide-border">
                    <div className="grid grid-cols-3 p-4">
                      <div className="font-medium text-sm">set_wifi</div>
                      <div className="text-sm text-muted-foreground">Configure WiFi connection</div>
                      <div className="text-sm text-muted-foreground">ssid, password</div>
                    </div>
                    <div className="grid grid-cols-3 p-4">
                      <div className="font-medium text-sm">kill_device</div>
                      <div className="text-sm text-muted-foreground">Deactivate device immediately</div>
                      <div className="text-sm text-muted-foreground">device_id</div>
                    </div>
                    <div className="grid grid-cols-3 p-4">
                      <div className="font-medium text-sm">set_current_sensor</div>
                      <div className="text-sm text-muted-foreground">Configure current sensor type</div>
                      <div className="text-sm text-muted-foreground">type (fluxgate/clip-on), range (1x/2x/4x)</div>
                    </div>
                    <div className="grid grid-cols-3 p-4">
                      <div className="font-medium text-sm">set_voltage_range</div>
                      <div className="text-sm text-muted-foreground">Configure voltage sensor range</div>
                      <div className="text-sm text-muted-foreground">range (1x/2x/4x)</div>
                    </div>
                    <div className="grid grid-cols-3 p-4">
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
