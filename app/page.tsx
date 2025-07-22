"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { CalendarIcon, RefreshCw, Plus, Trash, Loader2, Send, Settings, Filter, Clock, Download, MapPin, Activity, Zap, LogOut } from "lucide-react"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import { DatePicker } from "@mui/x-date-pickers/DatePicker"
import TextField from "@mui/material/TextField"
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

// All fields on one level - no subcats
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
  {
    name: "Set IoT Config",
    command: "set_iot_config",
    params: [
      { key: "root_ca", value: "" },
      { key: "client_cert", value: "" },
      { key: "client_key", value: "" },
      { key: "endpoint", value: "" },
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
  const [mapLoading, setMapLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(5)
  const [downsampleOptions, setDownsampleOptions] = useState<DownsampleOptions>({
    targetPoints: 100,
    method: 'average'
  })

  // DECOUPLED: Fetches the last month of data specifically for the map
  const fetchMapData = () => {
    setMapLoading(true);
    const end = new Date();
    const start = new Date(end.getTime() - 6 * 30 * 24 * 60 * 60 * 1000); // 6 months prior to now

    const params = new URLSearchParams({
      start: start.getTime().toString(),
      end: end.getTime().toString(),
    });

    fetch(`${config.api.rawData}?${params}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Map Data API ${res.status}: ${await res.text()}`);
        return res.json();
      })
      .then((data) => {
        const rawDataArray = Array.isArray(data) ? data : [];
        if (rawDataArray.length > 0) {
          const latestDataPerDevice = new Map<string, RawDataItem>();
          for (const item of rawDataArray) {
            const existing = latestDataPerDevice.get(item.deviceID);
            if (!existing || new Date(item.timestamp) > new Date(existing.timestamp)) {
              latestDataPerDevice.set(item.deviceID, item);
            }
          }
          const mapData: DeviceData[] = Array.from(latestDataPerDevice.values()).map(item => ({
            deviceId: item.deviceID,
            latitude: item.gnss?.lat ?? 0,
            longitude: item.gnss?.lon ?? 0,
            timestamp: item.timestamp,
            soc: (item as any).soc ?? 0,
            efficiency: (item as any).efficiency ?? 0,
          }));
          setLatestData(mapData);
        } else {
          setLatestData([]);
        }
      })
      .catch(err => {
        console.error("Failed to fetch map data:", err);
        setError(err.message); // You might want a separate mapError state
      })
      .finally(() => setMapLoading(false));
  };

  // Initial data fetch for the map
  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchMapData();
    }
  }, [auth.isAuthenticated]);

  // Auto-refresh logic for the map
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (autoRefresh && activeTab === 'map') {
      interval = setInterval(() => {
        console.log("Auto-refreshing map data...")
        fetchMapData()
      }, refreshIntervalSec * 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, refreshIntervalSec, activeTab])

  // Fetch raw data when date range changes
  useEffect(() => {
    if (!auth.isAuthenticated || !startDate || !endDate) return

    setLoading(true)
    setError("")

    // Use epoch milliseconds instead of ISO strings for query params
    const startTs = startDate.getTime().toString()
    const endTs = endDate.getTime().toString()
    const params = new URLSearchParams({
      start: startTs,
      end: endTs,
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
        setLoading(false)
      })
      .catch((err) => {
        console.error("Raw data fetch error:", err)
        setError(err.message)
        setLoading(false)
      })
  }, [auth.isAuthenticated, startDate, endDate, downsampleOptions])

  // Handle time range changes
  useEffect(() => {
    const now = new Date()
    let start: Date
    let end: Date = now

    switch (timeRange) {
      case "24hr":
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case "7d":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "1m":
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "1y":
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      case "all":
        start = new Date(0) // Beginning of time
        break
      case "custom":
        // Don't change dates for custom - let user set them
        return
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    setStartDate(start)
    setEndDate(end)
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

  // Show loading state while auth is initializing
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Show error if auth failed
  if (auth.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive">Authentication error: {auth.error.message}</p>
        </div>
      </div>
    )
  }

  // If not authenticated, redirect to signin
  if (!auth.isAuthenticated) {
    router.replace("/signin")
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-8">
          {/* Header with Logout Button */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Telematics Hub</h1>
              <p className="text-xl text-slate-600 dark:text-slate-400">Advanced fleet monitoring and control platform</p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push("/logout")}
              className="flex items-center space-x-2 self-center"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>

          {/* Hero Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight mb-2">Fleet Command Center</h2>
                  <p className="text-lg text-blue-100 max-w-2xl">
                    Real-time monitoring and control for your connected vehicles
                  </p>
                </div>
                <div className="hidden md:flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-2xl text-blue-200 font-bold">{latestData.length}</div>
                    <div className="text-sm text-blue-200">Active Devices</div>
                  </div>
                  <div className="w-px h-12 bg-blue-700"></div>
                  <div className="text-right">
                    <div className="text-2xl text-blue-200 font-bold">{rawData.length}</div>
                    <div className="text-sm text-blue-200">Data Points</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-slate-100 dark:bg-slate-800 p-0 rounded-xl">
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
  <>
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <DatePicker
        label="Start Date"
        value={startDate}
        onChange={(newVal) => setStartDate(newVal)}
        slotProps={{
          textField: {
            sx: {
              width: '100%',
              '& .MuiFormLabel-root': { color: '#55f' },
              '& .MuiInputAdornment-root .MuiIconButton-root': { color: '#0066ff' },
              '& .MuiInputBase-input': { color: '#0066ff' },
            },
            InputLabelProps: { style: { color: '#0066ff' } },
            InputProps: { style: { color: '#0066ff' } },
            variant: 'outlined',
          },
          popper: {
            sx: {
              '& .MuiPaper-root': {
                backgroundColor: '#0044aa'
              },
            },
          },
        }}
      />
    </LocalizationProvider>
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <DatePicker
        label="End Date"
        value={endDate}
        onChange={(newVal) => setEndDate(newVal)}
        slotProps={{
          textField: {
            sx: {
              width: '100%',
              '& .MuiFormLabel-root': { color: '#55f' },
              '& .MuiInputAdornment-root .MuiIconButton-root': { color: '#0066ff' },
              '& .MuiInputBase-input': { color: '#0066ff' },
            },
            InputLabelProps: { style: { color: '#0066ff' } },
            InputProps: { style: { color: '#0066ff' } },
            variant: 'outlined',
          },
          popper: {
            sx: {
              '& .MuiPaper-root': {
                backgroundColor: '#0044aa',
              },
            },
          },
        }}
      />
    </LocalizationProvider>
  </>
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
            <TabsContent value="map" className="space-y-6" forceMount>
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        Fleet Map
                      </CardTitle>
                      <CardDescription className="text-slate-600 dark:text-slate-400">
                        Real-time location tracking and fleet overview
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Switch checkedTrackColor="bg-blue-500" uncheckedTrackColor="bg-gray-300" thumbColor="bg-blue-500"
                        checked={autoRefresh}
                        onCheckedChange={setAutoRefresh}
                        id="auto-refresh"
                      />
                      <Label htmlFor="auto-refresh" className="text-sm">Auto Refresh</Label>
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="refresh-interval" className="text-sm">Interval (s):</Label>
                        <Input
                          id="refresh-interval"
                          type="number"
                          min="1"
                          value={refreshIntervalSec}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10)
                            if (!isNaN(val) && val > 0) setRefreshIntervalSec(val)
                          }}
                          className="w-20"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchMapData}
                        disabled={mapLoading}
                        className="flex items-center space-x-2"
                      >
                        {mapLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span>Refresh</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[600px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    {mapLoading && latestData.length === 0 ? (
                       <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="mt-4 text-slate-600 dark:text-slate-400">Loading Map Data...</p>
                      </div>
                    ) : latestData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                        <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                          <MapPin className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                          No Location Data Available
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">
                          No devices have reported location data in the last month. Check your device connections or try refreshing.
                        </p>
                        <Button
                          variant="outline"
                          onClick={fetchMapData}
                          disabled={mapLoading}
                          className="mt-4 flex items-center space-x-2"
                        >
                          {mapLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          <span>Refresh Data</span>
                        </Button>
                      </div>
                    ) : (
                      <VehicleMap devices={latestData} />
                    )}
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
                  {/* Command Help Accordion */}
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="help" className="border border-slate-200 dark:border-slate-700 rounded-lg">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center space-x-2">
                          <Settings className="w-4 h-4 text-blue-600" />
                          <span className="font-medium">Command Help & Examples</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-4 text-sm">
                          <div>
                            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Available Commands:</h4>
                            <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                              <li><strong>set_wifi</strong> - Configure WiFi credentials for device connectivity</li>
                              <li><strong>kill_device</strong> - Safely shut down a specific device</li>
                              <li><strong>set_current_sensor</strong> - Configure current sensor type and range (fluxgate/hall; 1x,2x,4x)</li>
                              <li><strong>set_voltage_range</strong> - Set voltage sensor measurement range (1x, 2x, 4x)</li>
                              <li><strong>set_lte_config</strong> - Configure LTE network settings</li>
                              <li><strong>set_iot_config</strong> - Configure IoT certificates and endpoint (root CA, client cert, client key, endpoint)</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Parameter Guidelines:</h4>
                            <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                              <li>• Use exact parameter names as shown in templates</li>
                              <li>• Values are case-sensitive</li>
                              <li>• Some commands require specific device IDs</li>
                              <li>• Commands are sent to all devices unless deviceId is specified</li>
                            </ul>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

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
      </div>
    </div>
  )
} 