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
  current_a?: { min: number; avg: number; max: number }
  temperature_c?: number
  signal_strength_dbm?: number
  speed?: number
  accel?: { x: number; y: number; z: number }
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

  const sortedData = [...rawData].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const timeRange = new Date(sortedData[sortedData.length - 1].timestamp).getTime() - 
                   new Date(sortedData[0].timestamp).getTime()
  
  const interval = timeRange / (options.targetPoints - 1)
  const downsampled: ApiDataItem[] = []

  for (let i = 0; i < options.targetPoints; i++) {
    const targetTime = new Date(sortedData[0].timestamp).getTime() + (i * interval)
    
    // Find data points within the time window
    const windowStart = targetTime - (interval / 2)
    const windowEnd = targetTime + (interval / 2)
    
    const windowData = sortedData.filter(item => {
      const itemTime = new Date(item.timestamp).getTime()
      return itemTime >= windowStart && itemTime <= windowEnd
    })

    if (windowData.length === 0) {
      // If no data in window, use nearest point
      const nearest = sortedData.reduce((prev, curr) => {
        const prevTime = Math.abs(new Date(prev.timestamp).getTime() - targetTime)
        const currTime = Math.abs(new Date(curr.timestamp).getTime() - targetTime)
        return prevTime < currTime ? prev : curr
      })
      downsampled.push(nearest as ApiDataItem)
    } else {
      // Aggregate data in window
      const aggregated = aggregateDataPoints(windowData, options.method)
      aggregated.timestamp = new Date(targetTime).toISOString()
      downsampled.push(aggregated as ApiDataItem)
    }
  }

  return downsampled
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
  const numericFields = ['voltage_v', 'temperature_c', 'signal_strength_dbm', 'speed', 'power_kw']
  
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
  if (data.some(item => item.current_a)) {
    const currentData = data.filter(item => item.current_a)
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