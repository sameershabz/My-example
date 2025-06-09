"use client"
import { useState, useEffect } from "react"
import { timeFormat } from "d3-time-format"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  Tooltip,
  ReferenceLine,
} from "recharts"

export interface ApiDataItem {
  deviceID: string
  timestamp: string
  gnss?: {
    quality_min: number
    quality_avg: number
    lat: number
    lon: number
    alt_m: number
    speed_kmh: number
    heading_deg: number
  }
  voltage_v?: number
  current_a?: { min: number; avg: number; max: number }
  temperature_c?: number
  signal_strength_dbm?: number
  speed?: number
  accel?: { x: number; y: number; z: number }
  power_kw?: number
  soc?: number
  efficiency?: number
  [key: string]: any
}

interface DataChart1Props {
  data: ApiDataItem[]
  chartFields: string[]
  loading: boolean
}

export default function DataChart1({ data, chartFields, loading }: DataChart1Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [rows, setRows] = useState<any[]>([])
  const [seriesKeys, setSeriesKeys] = useState<string[]>([])
  const [hoveredValue, setHoveredValue] = useState<{ key: string; value: number } | null>(null)

  useEffect(() => {
    if (!data.length) {
      setRows([])
      setSeriesKeys([])
      return
    }

    const fmt = timeFormat("%Y-%m-%d %H:%M")
    const sorted = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const devices = Array.from(new Set(sorted.map((d) => d.deviceID)))
    const timestamps = Array.from(new Set(sorted.map((d) => d.timestamp)))

    // build rows per timestamp
    const out = timestamps.map((ts) => {
      const r: any = { dateStr: fmt(new Date(ts)), timestamp: new Date(ts).getTime() }
      devices.forEach((dev) => {
        const item = sorted.find((d) => d.timestamp === ts && d.deviceID === dev)
        chartFields.forEach((f) => {
          const key = `${dev}-${f}`
          let val: number | null = null
          if (item) {
            if (f in item) {
              val = (item as any)[f]
            } else if (item.gnss && f in item.gnss) {
              val = (item.gnss as any)[f]
            } else if (item.current_a && ["min", "avg", "max"].includes(f)) {
              val = (item.current_a as any)[f]
            } else if (item.accel && f.startsWith("accel_")) {
              const axis = f.split("_")[1]
              val = (item.accel as any)[axis]
            }
          }
          r[key] = val
        })
      })
      return r
    })

    const keys = devices.flatMap((dev) => chartFields.map((f) => `${dev}-${f}`))
    setRows(out)
    setSeriesKeys(keys)
  }, [data, chartFields])

  const handleLegendClick = (e: any) => {
    const key = e.dataKey || e.value
    const s = new Set(hidden)
    hidden.has(key) ? s.delete(key) : s.add(key)
    setHidden(s)
  }

  const handleMouseMove = (e: any) => {
    if (e.activePayload && e.activePayload.length) {
      const payload = e.activePayload.find((p: any) => !hidden.has(p.dataKey))
      if (payload) {
        setHoveredValue({
          key: payload.dataKey,
          value: payload.value,
        })
      }
    }
  }

  const handleMouseLeave = () => {
    setHoveredValue(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading chart data...</p>
        </div>
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow">
        <div className="text-center">
          <p className="text-gray-600">No data available for the selected filters</p>
          <p className="text-sm text-gray-500 mt-2">Try adjusting your filters or time range</p>
        </div>
      </div>
    )
  }

  const total = seriesKeys.length
  const getColor = (i: number) => `hsl(${Math.round((i / total) * 360)},70%,50%)`

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Telemetry Data</h2>
        {hoveredValue && (
          <div className="text-sm text-gray-600">
            Selected: <span className="font-medium">{hoveredValue.key}</span> - Value:{" "}
            <span className="font-medium">{hoveredValue.value}</span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={rows}
          margin={{ top: 20, right: 20, bottom: 80, left: 0 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="dateStr" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12, fill: "#666" }} />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12, fill: "#666" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              border: "1px solid #ddd",
              borderRadius: 4,
              boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
            }}
          />
          <Legend
            onClick={handleLegendClick}
            layout="horizontal"
            verticalAlign="top"
            align="center"
            wrapperStyle={{ paddingBottom: 10 }}
          />
          {seriesKeys.map((key, i) => (
            <Line
              key={key}
              dataKey={key}
              name={key}
              stroke={getColor(i)}
              strokeWidth={2}
              connectNulls
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
              hide={hidden.has(key)}
              animationDuration={500}
            />
          ))}
          {/* Add reference lines for important thresholds if needed */}
          {chartFields.includes("voltage_v") && (
            <ReferenceLine y={12} stroke="red" strokeDasharray="3 3" label="Min Voltage" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
