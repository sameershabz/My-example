"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "react-oidc-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { RefreshCw, Plus, Trash, Loader2, Send, Settings, Filter, Clock, MapPin, Activity, Zap, LogOut } from "lucide-react"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import DataChart1 from "./components/DataChart1"
import dynamic from "next/dynamic"
import type { DeviceData } from "./components/VehicleMap"
import type { RawDataItem, DownsampleOptions } from "@/lib/data-processor"
import { downsampleData, normalizeRawData } from "@/lib/data-processor"
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

type TimeRange =
  | "1min" | "3min" | "5min"
  | "15m" | "1h" | "6h" | "12h" | "24hr" | "48h"
  | "7d" | "1m" | "3m" | "1y"
  | "max" | "custom"

const timeRanges: { label: string; value: TimeRange }[] = [
  { label: "1 Minute", value: "1min" },
  { label: "3 Minutes", value: "3min" },
  { label: "5 Minutes", value: "5min" },
  { label: "15 Minutes", value: "15m" },
  { label: "1 Hour", value: "1h" },
  { label: "6 Hours", value: "6h" },
  { label: "12 Hours", value: "12h" },
  { label: "24 Hours", value: "24hr" },
  { label: "48 Hours", value: "48h" },
  { label: "7 Days", value: "7d" },
  { label: "1 Month", value: "1m" },
  { label: "3 Months", value: "3m" },
  { label: "1 Year", value: "1y" },
  { label: "Max", value: "max" },
  { label: "Custom", value: "custom" },
]

// Data fields aligned with IoT Core SQL output (normalized)
const allFields = [
  "voltage_v",
  "current_a",
  "temperature_c",
  "accel_x",
  "accel_y",
  "accel_z",
  "power_kw",
  "lat",
  "lon",
  "alt_m",
  "speed_kmh",
  "heading_deg",
  "quality_avg",
  // flags
  "lte_ok",
  "gnss_ok",
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
  const defaultDeviceIds = config.devices.defaultDeviceIds
  const [activeTab, setActiveTab] = useState("chart")
  const [rawData, setRawData] = useState<RawDataItem[]>([])
  const [downsampledData, setDownsampledData] = useState<RawDataItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [chartFields, setChartFields] = useState<string[]>(["voltage_v"])
  const [desiredChartPoints, setDesiredChartPoints] = useState<number>(100)
  const [availableDevices, setAvailableDevices] = useState<string[]>(defaultDeviceIds)
  const [selectedDevices, setSelectedDevices] = useState<string[]>(["all"])
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>("7d")
  const [command, setCommand] = useState("")
  const [params, setParams] = useState<ParamItem[]>([])
  const [commandLoading, setCommandLoading] = useState(false)
  const [commandSuccess, setCommandSuccess] = useState("")
  const [latestData, setLatestData] = useState<DeviceData[]>([])
  const [mapLoading, setMapLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(5)
  // Chart auto-refresh controls
  const [autoRefreshChart, setAutoRefreshChart] = useState(false)
  const [refreshIntervalChartSec, setRefreshIntervalChartSec] = useState(5)
  const [refreshTick, setRefreshTick] = useState(0)
  const [refreshingChart, setRefreshingChart] = useState(false)
  // Chart X-axis auto-range toggle
  const [autoRangeChart, setAutoRangeChart] = useState(true)
  const downsampleMethod: DownsampleOptions['method'] = 'average'
  // When the latest chart dataset arrived (ms since epoch)
  const [lastReceivedAtMs, setLastReceivedAtMs] = useState<number | null>(null)

  const PAGE_SIZE = 2500
  const MAX_PAGES = 50

  const arraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false
    return a.every((value, index) => value === b[index])
  }

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object'

  const refreshMapData = useCallback(() => {
    setMapLoading(true)
    setRefreshTick((t) => t + 1)
  }, [])

  useEffect(() => {
    if (!auth.isAuthenticated) return
    refreshMapData()
  }, [auth.isAuthenticated, refreshMapData])

  // Auto-refresh logic for the map
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (autoRefresh && activeTab === 'map') {
      interval = setInterval(() => {
        console.log("Auto-refreshing map data...")
        refreshMapData()
      }, refreshIntervalSec * 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, refreshIntervalSec, activeTab, refreshMapData])

  useEffect(() => {
    if (rawData.length === 0) {
      setLatestData([])
      setMapLoading(false)
      return
    }

    const latestDataPerDevice = new Map<string, RawDataItem>()
    const hasValidLocation = (item: RawDataItem) => {
      const latValue = item.gnss?.lat ?? item.lat
      const lonValue = item.gnss?.lon ?? item.lon
      if (latValue === undefined || lonValue === undefined) return false
      return !(latValue === 0 && lonValue === 0)
    }

    for (const item of rawData) {
      if (!hasValidLocation(item)) continue
      const existing = latestDataPerDevice.get(item.deviceID)
      if (!existing || new Date(item.timestamp) > new Date(existing.timestamp)) {
        latestDataPerDevice.set(item.deviceID, item)
      }
    }

    const mapData: DeviceData[] = Array.from(latestDataPerDevice.values()).map((item) => {
      const tsMs = new Date(item.timestamp).getTime()
      const tsSatMs = tsMs - 6 * 60 * 60 * 1000 // minus 6h to SAT per request
      const randSoc = Math.round(20 + Math.random() * 80)
      const randEff = +(3 + Math.random() * 4).toFixed(1)
      const latValue = item.gnss?.lat ?? item.lat
      const lonValue = item.gnss?.lon ?? item.lon
      if (typeof latValue !== 'number' || typeof lonValue !== 'number') {
        return null
      }
      return {
        deviceId: item.deviceID,
        latitude: latValue,
        longitude: lonValue,
        timestamp: new Date(tsSatMs).toISOString(),
        soc: randSoc,
        efficiency: randEff,
      }
    }).filter((entry): entry is DeviceData => entry !== null)

    setLatestData(mapData)
    setMapLoading(false)
  }, [rawData])

  useEffect(() => {
    const combined = Array.from(new Set([
      ...defaultDeviceIds,
      ...rawData.map((d) => d.deviceID)
    ])).sort()

    setAvailableDevices((prev) => (arraysEqual(prev, combined) ? prev : combined))
  }, [rawData, defaultDeviceIds])

  useEffect(() => {
    if (selectedDevices.includes("all")) return
    const filtered = selectedDevices.filter((id) => availableDevices.includes(id))
    if (filtered.length === selectedDevices.length) return
    setSelectedDevices(filtered.length ? filtered : ["all"])
  }, [availableDevices, selectedDevices])

  // Auto-refresh logic for the chart
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (autoRefreshChart && activeTab === 'chart') {
      interval = setInterval(() => {
        console.log("Auto-refreshing chart data...")
        setRefreshingChart(true)
        setRefreshTick((t) => t + 1)
      }, refreshIntervalChartSec * 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefreshChart, refreshIntervalChartSec, activeTab])

  // Fetch raw data for chart
  useEffect(() => {
    if (!auth.isAuthenticated) return

    setError("")

    const now = Date.now()
    let startMs: number
    let endMs: number

    if (timeRange === 'custom') {
      if (!startDate || !endDate) {
        setRefreshingChart(false)
        setMapLoading(false)
        return
      }
      startMs = startDate.getTime()
      endMs = endDate.getTime()
    } else {
      endMs = now
      switch (timeRange) {
        case '1min': startMs = endMs - 1 * 60 * 1000; break
        case '3min': startMs = endMs - 3 * 60 * 1000; break
        case '5min': startMs = endMs - 5 * 60 * 1000; break
        case '15m': startMs = endMs - 15 * 60 * 1000; break
        case '1h': startMs = endMs - 60 * 60 * 1000; break
        case '6h': startMs = endMs - 6 * 60 * 60 * 1000; break
        case '12h': startMs = endMs - 12 * 60 * 60 * 1000; break
        case '24hr': startMs = endMs - 24 * 60 * 60 * 1000; break
        case '48h': startMs = endMs - 48 * 60 * 60 * 1000; break
        case '7d': startMs = endMs - 7 * 24 * 60 * 60 * 1000; break
        case '1m': startMs = endMs - 30 * 24 * 60 * 60 * 1000; break
        case '3m': startMs = endMs - 90 * 24 * 60 * 60 * 1000; break
        case '1y': startMs = endMs - 365 * 24 * 60 * 60 * 1000; break
        case 'max': startMs = 0; break
        default: startMs = endMs - 30 * 24 * 60 * 60 * 1000; break
      }
    }

    const silent = refreshingChart
    if (!silent) setLoading(true)

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      if (!silent) setLoading(false)
      setRefreshingChart(false)
      setError("Please select valid start and end dates.")
      setMapLoading(false)
      return
    }

    const startTs = Math.min(startMs, endMs).toString()
    const endTs = Math.max(startMs, endMs).toString()

    const effectiveDevices = (() => {
      const base = selectedDevices.includes("all") || selectedDevices.length === 0
        ? (availableDevices.length ? availableDevices : defaultDeviceIds)
        : selectedDevices
      return Array.from(new Set(base)).filter((id) => id && id.length > 0)
    })()

    if (effectiveDevices.length === 0) {
      setRawData([])
      setRefreshingChart(false)
      if (!silent) setLoading(false)
      setMapLoading(false)
      return
    }

    const controller = new AbortController()
    setMapLoading(true)

    const fetchDevices = async () => {
      try {
        const aggregated: Record<string, unknown>[] = []

        for (const deviceId of effectiveDevices) {
          let nextKey: string | null = null
          let pageCount = 0

          do {
            const params = new URLSearchParams({
              deviceId,
              pageSize: PAGE_SIZE.toString(),
            })
            if (startTs) params.set("start", startTs)
            if (endTs) params.set("end", endTs)
            if (nextKey) params.set("nextKey", nextKey)

            const response = await fetch(`${config.api.rawData}?${params.toString()}`, {
              credentials: "include",
              signal: controller.signal,
            })

            if (!response.ok) {
              const errorText = await response.text()
              throw new Error(`Raw data API ${response.status}: ${errorText}`)
            }

            const payload = (await response.json()) as {
              items?: unknown[]
              nextKey?: string | null
              error?: string
            }

            if (payload.error) {
              throw new Error(payload.error)
            }

            const items = Array.isArray(payload.items) ? payload.items : []
            items.forEach((itemRaw) => {
              if (!isRecord(itemRaw)) return
              const normalizedItem: Record<string, unknown> = { ...itemRaw }
              const resolvedDeviceId = normalizedItem.deviceID ?? normalizedItem.deviceId ?? deviceId
              normalizedItem.deviceID = String(resolvedDeviceId ?? deviceId)
              aggregated.push(normalizedItem)
            })

            nextKey = payload.nextKey ?? null
            pageCount += 1

            if (pageCount > MAX_PAGES) {
              console.warn(`Reached page limit (${MAX_PAGES}) for device`, deviceId)
              break
            }
          } while (nextKey && !controller.signal.aborted)

          if (controller.signal.aborted) break
        }

        if (controller.signal.aborted) return

        const normalized = normalizeRawData(aggregated)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

        const dedupedMap = new Map<string, RawDataItem>()
        normalized.forEach((item) => {
          const key = `${item.deviceID}-${item.timestamp}`
          dedupedMap.set(key, item)
        })

        const dedupedNormalized = Array.from(dedupedMap.values()).sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )

        setRawData(dedupedNormalized)
        setLastReceivedAtMs(Date.now())
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        console.error("Raw data fetch error:", err)
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
        setRawData([])
      } finally {
        if (!silent) setLoading(false)
        setRefreshingChart(false)
        setMapLoading(false)
      }
    }

    fetchDevices()

    return () => {
      controller.abort()
    }
  }, [
    auth.isAuthenticated,
    startDate,
    endDate,
    timeRange,
    refreshTick,
    selectedDevices,
    availableDevices,
    refreshingChart,
    defaultDeviceIds,
  ])

  // Handle time range changes
  useEffect(() => {
    const now = new Date()
    let start: Date
    const end: Date = now

    switch (timeRange) {
      case "1min":
        start = new Date(now.getTime() - 1 * 60 * 1000)
        break
      case "3min":
        start = new Date(now.getTime() - 3 * 60 * 1000)
        break
      case "5min":
        start = new Date(now.getTime() - 5 * 60 * 1000)
        break
      case "15m":
        start = new Date(now.getTime() - 15 * 60 * 1000)
        break
      case "1h":
        start = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case "6h":
        start = new Date(now.getTime() - 6 * 60 * 60 * 1000)
        break
      case "12h":
        start = new Date(now.getTime() - 12 * 60 * 60 * 1000)
        break
      case "24hr":
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case "48h":
        start = new Date(now.getTime() - 48 * 60 * 60 * 1000)
        break
      case "7d":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "1m":
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "3m":
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case "1y":
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      case "max":
        start = new Date(0)
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
  
  // Compute fixed x-domain for chart when auto-range is off
  const xDomain: [number, number] | null = (() => {
    if (!startDate || !endDate) return null
    const a = startDate.getTime()
    const b = endDate.getTime()
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null
    return [Math.min(a, b), Math.max(a, b)]
  })()

  // Recompute downsampled series when raw data or desired resolution changes
  useEffect(() => {
    if (rawData.length === 0) {
      setDownsampledData([])
      return
    }

    const targetPoints = Math.max(10, Math.min(desiredChartPoints, rawData.length, 10000))
    const downsampled = downsampleData(rawData, { method: downsampleMethod, targetPoints })
    setDownsampledData(downsampled)
  }, [rawData, desiredChartPoints, downsampleMethod])

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
                  <h2 className="text-3xl font-bold tracking-tight mb-2 text-white">Fleet Command Center</h2>
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
      <DateTimePicker
        label="Start Date & Time"
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
      <DateTimePicker
        label="End Date & Time"
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
                          {["all", ...availableDevices].map((dev) => (
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
                              max="100000"
                              value={desiredChartPoints}
                              onChange={(e) => {
                                const v = parseInt(e.target.value) || 100
                                setDesiredChartPoints(v)
                              }}
                              className="w-24"
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {/* Chart Display */}
                  {/* Chart Refresh Controls */}
                  <div className="flex items-center justify-end gap-4 mt-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checkedTrackColor="bg-blue-500"
                        uncheckedTrackColor="bg-gray-300"
                        thumbColor="bg-blue-500"
                        checked={autoRangeChart}
                        onCheckedChange={setAutoRangeChart}
                        id="auto-range-chart"
                      />
                      <Label htmlFor="auto-range-chart" className="text-sm text-slate-700 dark:text-slate-300">Auto Range</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checkedTrackColor="bg-blue-500"
                        uncheckedTrackColor="bg-gray-300"
                        thumbColor="bg-blue-500"
                        checked={autoRefreshChart}
                        onCheckedChange={setAutoRefreshChart}
                        id="auto-refresh-chart"
                      />
                      <Label htmlFor="auto-refresh-chart" className="text-sm text-slate-700 dark:text-slate-300">Auto Refresh</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="refresh-interval-chart" className="text-sm text-slate-700 dark:text-slate-300">Interval (s):</Label>
                      <Input
                        id="refresh-interval-chart"
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={refreshIntervalChartSec}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          if (!isNaN(val) && val > 0) setRefreshIntervalChartSec(val)
                        }}
                        className="w-20"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setRefreshingChart(true); setRefreshTick(t => t + 1) }}
                      disabled={loading || refreshingChart}
                      className="flex items-center space-x-2"
                    >
                      {loading || refreshingChart ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      <span>Refresh</span>
                    </Button>
                  </div>

                  {/* Chart Display */}
                  <div className="mt-8">
                    <DataChart1 
                      data={filteredData} 
                      chartFields={chartFields} 
                      loading={loading}
                      rawData={rawData}
                      autoRange={autoRangeChart}
                      xDomain={xDomain}
                      lastReceivedAtMs={lastReceivedAtMs}
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
                          min="0.1"
                          step="0.1"
                          value={refreshIntervalSec}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            if (!isNaN(val) && val > 0) setRefreshIntervalSec(val)
                          }}
                          className="w-20"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshMapData}
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
                          No devices have reported location data in the selected range. Check your device connections or try refreshing.
                        </p>
                        <Button
                          variant="outline"
                          onClick={refreshMapData}
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
                  {/* Fleet Info Block */}
                  {latestData.length > 0 && (
                    <div className="mt-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Fleet Snapshot</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {latestData.map((d) => {
                          const batteryKWh = 50
                          const availableKWh = (batteryKWh * d.soc) / 100
                          const estRangeKm = Math.round(availableKWh * d.efficiency)
                          return (
                            <div key={d.deviceId} className="flex items-center justify-between px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                              <div>
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{d.deviceId}</div>
                                <div className="text-xs text-slate-600 dark:text-slate-400">Eff {d.efficiency.toFixed(1)} km/kWh</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-slate-900 dark:text-slate-100">SoC {d.soc}%</div>
                                <div className="text-xs text-slate-600 dark:text-slate-400">~{estRangeKm} km</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Note: SoC and efficiency values are randomized for visualization. Range assumes a 50 kWh battery.</div>
                    </div>
                  )}
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
