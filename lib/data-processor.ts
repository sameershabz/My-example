import type { ApiDataItem } from "@/app/components/DataChart1"

export interface RawDataItem {
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
  // Accept either scalar current or object with stats
  current_a?: number | { min: number; avg: number; max: number }
  temperature_c?: number
  signal_strength_dbm?: number
  speed?: number
  // Support both nested and flattened accel
  accel?: { x: number; y: number; z: number }
  accel_x?: number
  accel_y?: number
  accel_z?: number
  power_kw?: number
  [key: string]: any
}

export interface DownsampleOptions {
  targetPoints: number
  method: 'average' | 'max' | 'min' | 'latest'
  timeWindow?: number // in milliseconds
}

/**
 * Downsamples raw data for chart display
 */
export function downsampleData(
  rawData: RawDataItem[],
  options: DownsampleOptions
): ApiDataItem[] {
  if (rawData.length <= options.targetPoints) {
    return rawData as ApiDataItem[]
  }

  // Group by device to avoid mixing device series during aggregation
  const byDevice = new Map<string, RawDataItem[]>()
  for (const item of rawData) {
    const arr = byDevice.get(item.deviceID) || []
    arr.push(item)
    byDevice.set(item.deviceID, arr)
  }

  const results: ApiDataItem[] = []

  for (const [deviceID, deviceData] of byDevice) {
    const sortedData = [...deviceData].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    if (sortedData.length <= options.targetPoints) {
      results.push(...(sortedData as ApiDataItem[]))
      continue
    }

    const startMs = new Date(sortedData[0].timestamp).getTime()
    const endMs = new Date(sortedData[sortedData.length - 1].timestamp).getTime()
    const timeRange = Math.max(1, endMs - startMs)
    const interval = timeRange / (options.targetPoints - 1)

    for (let i = 0; i < options.targetPoints; i++) {
      const targetTime = startMs + i * interval
      const windowStart = targetTime - interval / 2
      const windowEnd = targetTime + interval / 2

      const windowData = sortedData.filter((item) => {
        const t = new Date(item.timestamp).getTime()
        return t >= windowStart && t <= windowEnd
      })

      if (windowData.length === 0) {
        const nearest = sortedData.reduce((prev, curr) => {
          const prevDt = Math.abs(new Date(prev.timestamp).getTime() - targetTime)
          const currDt = Math.abs(new Date(curr.timestamp).getTime() - targetTime)
          return prevDt < currDt ? prev : curr
        })
        results.push(nearest as ApiDataItem)
      } else {
        const aggregated = aggregateDataPoints(windowData, options.method)
        aggregated.deviceID = deviceID
        aggregated.timestamp = new Date(targetTime).toISOString()
        results.push(aggregated as ApiDataItem)
      }
    }
  }

  // Keep global results sorted
  results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  return results
}

/**
 * Aggregates multiple data points based on the specified method
 */
function aggregateDataPoints(data: RawDataItem[], method: string): RawDataItem {
  if (data.length === 1) return data[0]

  const result: RawDataItem = {
    deviceID: data[0].deviceID,
    timestamp: data[0].timestamp,
  }

  // Aggregate numeric fields
  const numericFields = [
    'voltage_v',
    'temperature_c',
    'signal_strength_dbm',
    'speed',
    'power_kw',
    'current_a',
    // Common flattened fields we should preserve/aggregate
    'accel_x', 'accel_y', 'accel_z',
    'lat', 'lon', 'alt_m', 'heading_deg', 'speed_kmh', 'quality_avg'
  ]
  
  numericFields.forEach(field => {
    const values = data.map(item => (item as any)[field]).filter(v => v !== undefined && v !== null)
    if (values.length > 0) {
      switch (method) {
        case 'average':
          (result as any)[field] = values.reduce((a, b) => a + b, 0) / values.length
          break
        case 'max':
          (result as any)[field] = Math.max(...values)
          break
        case 'min':
          (result as any)[field] = Math.min(...values)
          break
        case 'latest':
          (result as any)[field] = values[values.length - 1]
          break
      }
    }
  })

  // Handle nested objects
  if (data.some(item => item.gnss)) {
    const gnssData = data.filter(item => item.gnss)
    if (gnssData.length > 0) {
      const gnssFields = ['lat', 'lon', 'alt_m', 'speed_kmh', 'heading_deg', 'quality_min', 'quality_avg']
      result.gnss = {} as any
      
      gnssFields.forEach(field => {
        const values = gnssData.map(item => (item.gnss as any)[field]).filter(v => v !== undefined && v !== null)
        if (values.length > 0) {
          switch (method) {
            case 'average':
              (result.gnss as any)[field] = values.reduce((a, b) => a + b, 0) / values.length
              break
            case 'max':
              (result.gnss as any)[field] = Math.max(...values)
              break
            case 'min':
              (result.gnss as any)[field] = Math.min(...values)
              break
            case 'latest':
              (result.gnss as any)[field] = values[values.length - 1]
              break
          }
        }
      })
    }
  }

  // Handle current_a object
  if (data.some(item => item.current_a && typeof item.current_a === 'object')) {
    const currentData = data.filter(item => item.current_a && typeof item.current_a === 'object')
    if (currentData.length > 0) {
      const currentFields = ['min', 'avg', 'max']
      result.current_a = {} as any
      
      currentFields.forEach(field => {
        const values = currentData.map(item => (item.current_a as any)[field]).filter(v => v !== undefined && v !== null)
        if (values.length > 0) {
          switch (method) {
            case 'average':
              (result.current_a as any)[field] = values.reduce((a, b) => a + b, 0) / values.length
              break
            case 'max':
              (result.current_a as any)[field] = Math.max(...values)
              break
            case 'min':
              (result.current_a as any)[field] = Math.min(...values)
              break
            case 'latest':
              (result.current_a as any)[field] = values[values.length - 1]
              break
          }
        }
      })
    }
  }

  // Handle accel object
  if (data.some(item => item.accel)) {
    const accelData = data.filter(item => item.accel)
    if (accelData.length > 0) {
      const accelFields = ['x', 'y', 'z']
      result.accel = {} as any
      
      accelFields.forEach(field => {
        const values = accelData.map(item => (item.accel as any)[field]).filter(v => v !== undefined && v !== null)
        if (values.length > 0) {
          switch (method) {
            case 'average':
              (result.accel as any)[field] = values.reduce((a, b) => a + b, 0) / values.length
              break
            case 'max':
              (result.accel as any)[field] = Math.max(...values)
              break
            case 'min':
              (result.accel as any)[field] = Math.min(...values)
              break
            case 'latest':
              (result.accel as any)[field] = values[values.length - 1]
              break
          }
        }
      })
    }
  }

  return result
}

/**
 * Normalize incoming raw records from various sources (IoT Core, Timestream, etc.)
 * to the shape expected by charts and downsampling.
 */
export function normalizeRawData(input: any[]): RawDataItem[] {
  return input.map(normalizeRawItem)
}

export function normalizeRawItem(rec: any): RawDataItem {
  const ts = rec.timestamp
  const timestampIso = typeof ts === 'number' ? new Date(ts).toISOString() : new Date(ts).toISOString()

  // Voltage / current / temp
  const voltage_v: number | undefined = rec.voltage_v ?? rec.voltage_V ?? undefined
  const currentASrc: number | undefined = rec.current_a ?? rec.current_A ?? undefined
  const temperature_c: number | undefined = rec.temperature_c ?? rec.temp_C ?? undefined

  // Accel (flattened + nested)
  const ax: number | undefined = rec.accel_x ?? rec.accel?.x
  const ay: number | undefined = rec.accel_y ?? rec.accel?.y
  const az: number | undefined = rec.accel_z ?? rec.accel?.z

  // GNSS fields
  const lat: number | undefined = rec.lat ?? rec.gnss_lat ?? rec.gnss?.lat
  const lon: number | undefined = rec.lon ?? rec.gnss_lon ?? rec.gnss?.lon
  const alt_m: number | undefined = rec.alt_m ?? rec.gnss_alt_m ?? rec.alt
  const speed_m_s: number | undefined = rec.speed_m_s ?? rec.gnss_speed
  const speed_kmh: number | undefined = rec.speed_kmh ?? (typeof speed_m_s === 'number' ? speed_m_s * 3.6 : undefined)
  const heading_deg: number | undefined = rec.heading_deg ?? rec.gnss_heading
  const quality_avg: number | undefined = rec.quality_avg ?? rec.hdop ?? rec.gnss_quality

  // Power: use provided or compute
  const power_kw: number | undefined = rec.power_kw ?? (
    typeof voltage_v === 'number' && typeof currentASrc === 'number'
      ? (voltage_v * currentASrc) / 1000.0
      : undefined
  )

  const out: RawDataItem = {
    deviceID: rec.deviceID,
    timestamp: timestampIso,
  }

  if (typeof voltage_v === 'number') out.voltage_v = voltage_v
  if (typeof currentASrc === 'number') out.current_a = currentASrc
  if (typeof temperature_c === 'number') out.temperature_c = temperature_c
  if (typeof power_kw === 'number') out.power_kw = power_kw

  if (typeof ax === 'number') out.accel_x = ax
  if (typeof ay === 'number') out.accel_y = ay
  if (typeof az === 'number') out.accel_z = az
  if (ax != null || ay != null || az != null) {
    out.accel = { x: ax as any, y: ay as any, z: az as any }
  }

  if (
    lat != null || lon != null || alt_m != null || speed_kmh != null || heading_deg != null || quality_avg != null
  ) {
    out.gnss = {
      lat: lat as any,
      lon: lon as any,
      alt_m: alt_m as any,
      speed_kmh: speed_kmh as any,
      heading_deg: heading_deg as any,
      quality_min: undefined as any, // unknown, keep slot for compatibility
      quality_avg: quality_avg as any,
    }

    // Also expose flattened copies for chart fields that read top-level
    if (lat != null) (out as any).lat = lat
    if (lon != null) (out as any).lon = lon
    if (alt_m != null) (out as any).alt_m = alt_m
    if (heading_deg != null) (out as any).heading_deg = heading_deg
    if (speed_kmh != null) (out as any).speed_kmh = speed_kmh
    if (quality_avg != null) (out as any).quality_avg = quality_avg
  }

  return out
}

/**
 * Converts data to CSV format for download
 */
export function dataToCSV(data: RawDataItem[]): string {
  if (data.length === 0) return ''

  // Get all possible fields from the data
  const allFields = new Set<string>()
  data.forEach(item => {
    Object.keys(item).forEach(key => {
      if (key !== 'deviceID' && key !== 'timestamp') {
        allFields.add(key)
      }
    })
  })

  const fields = ['deviceID', 'timestamp', ...Array.from(allFields).sort()]
  
  // Create CSV header
  const header = fields.join(',')
  
  // Create CSV rows
  const rows = data.map(item => {
    return fields.map(field => {
      if (field === 'deviceID') return `"${item.deviceID}"`
      if (field === 'timestamp') return `"${item.timestamp}"`
      
      const value = (item as any)[field]
      if (value === undefined || value === null) return ''
      
      if (typeof value === 'object') {
        return `"${JSON.stringify(value)}"`
      }
      
      return `"${value}"`
    }).join(',')
  })

  return [header, ...rows].join('\n')
} 
