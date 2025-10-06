export interface GnssData {
  quality_min?: number
  quality_avg?: number
  lat?: number
  lon?: number
  alt_m?: number
  speed_kmh?: number
  heading_deg?: number
}

export interface CurrentStats {
  min?: number
  avg?: number
  max?: number
}

export interface AccelVector {
  x?: number
  y?: number
  z?: number
}

export interface RawDataItem {
  deviceID: string
  timestamp: string
  gnss?: GnssData
  voltage_v?: number
  // Accept either scalar current or object with stats
  current_a?: number | CurrentStats
  temperature_c?: number
  // Support both nested and flattened accel
  accel?: AccelVector
  accel_x?: number
  accel_y?: number
  accel_z?: number
  power_kw?: number
  lat?: number
  lon?: number
  alt_m?: number
  speed_kmh?: number
  heading_deg?: number
  quality_avg?: number
  // Flags
  lte_ok?: number | boolean
  gnss_ok?: number | boolean
  extra?: Record<string, unknown>
  [key: string]: unknown
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object'

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
): RawDataItem[] {
  if (rawData.length <= options.targetPoints) {
    return [...rawData]
  }

  // Group by device to avoid mixing device series during aggregation
  const byDevice = new Map<string, RawDataItem[]>()
  for (const item of rawData) {
    const arr = byDevice.get(item.deviceID) || []
    arr.push(item)
    byDevice.set(item.deviceID, arr)
  }

  const results: RawDataItem[] = []

  for (const [deviceID, deviceData] of byDevice) {
    const sortedData = [...deviceData].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    if (sortedData.length <= options.targetPoints) {
      results.push(...sortedData)
      continue
    }

    const bucketSize = Math.max(1, Math.ceil(sortedData.length / options.targetPoints))

    for (let startIndex = 0; startIndex < sortedData.length; startIndex += bucketSize) {
      const bucket = sortedData.slice(startIndex, startIndex + bucketSize)
      if (bucket.length === 0) continue

      const aggregated = aggregateDataPoints(bucket, options.method)
      aggregated.deviceID = deviceID
      aggregated.timestamp = bucket[bucket.length - 1].timestamp
      results.push(aggregated)
    }
  }

  // Keep global results sorted
  results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  return results
}

/**
 * Aggregates multiple data points based on the specified method
 */
function aggregateDataPoints(data: RawDataItem[], method: DownsampleOptions['method']): RawDataItem {
  if (data.length === 1) return data[0]

  const result: RawDataItem = {
    deviceID: data[0].deviceID,
    timestamp: data[0].timestamp,
  }

  // Aggregate numeric fields
  const numericFields = [
    'voltage_v',
    'temperature_c',
    'power_kw',
    'current_a',
    'accel_x', 'accel_y', 'accel_z',
    'lat', 'lon', 'alt_m', 'heading_deg', 'speed_kmh', 'quality_avg',
    'lte_ok',
    'gnss_ok'
  ] as const

  const resultRecord = result as Record<string, number | undefined>

  numericFields.forEach((field) => {
    const values = data
      .map((item) => {
        const rawValue = item[field]
        if (typeof rawValue === 'number') return rawValue
        if (field === 'current_a' && rawValue && typeof rawValue === 'object') {
          const stats = rawValue as CurrentStats
          return stats.avg ?? stats.min ?? stats.max
        }
        if ((field === 'lte_ok' || field === 'gnss_ok') && rawValue !== undefined && rawValue !== null) {
          if (typeof rawValue === 'boolean') return rawValue ? 1 : 0
          if (typeof rawValue === 'number') return rawValue
          const parsed = Number(rawValue)
          return Number.isFinite(parsed) ? parsed : undefined
        }
        return undefined
      })
      .filter((value): value is number => value !== undefined && Number.isFinite(value))

    if (values.length === 0) return

    if (field === 'lte_ok' || field === 'gnss_ok') {
      resultRecord[field] = Math.min(...values)
      return
    }

    switch (method) {
      case 'average':
        resultRecord[field] = values.reduce((a, b) => a + b, 0) / values.length
        break
      case 'max':
        resultRecord[field] = Math.max(...values)
        break
      case 'min':
        resultRecord[field] = Math.min(...values)
        break
      case 'latest':
        resultRecord[field] = values[values.length - 1]
        break
      default:
        resultRecord[field] = values[values.length - 1]
        break
    }
  })

  // Handle nested objects
  if (data.some((item) => item.gnss)) {
    const gnssData = data.filter((item) => item.gnss)
    if (gnssData.length > 0) {
      const gnssFields: Array<keyof GnssData> = ['lat', 'lon', 'alt_m', 'speed_kmh', 'heading_deg', 'quality_min', 'quality_avg']
      const gnssResult: GnssData = {}

      gnssFields.forEach((field) => {
        const values = gnssData
          .map((item) => item.gnss?.[field])
          .filter((value): value is number => isNumber(value))

        if (values.length === 0) return

        switch (method) {
          case 'average':
            gnssResult[field] = values.reduce((a, b) => a + b, 0) / values.length
            break
          case 'max':
            gnssResult[field] = Math.max(...values)
            break
          case 'min':
            gnssResult[field] = Math.min(...values)
            break
          case 'latest':
            gnssResult[field] = values[values.length - 1]
            break
          default:
            gnssResult[field] = values[values.length - 1]
            break
        }
      })

      if (Object.keys(gnssResult).length > 0) {
        result.gnss = gnssResult
      }
    }
  }

  if (data.some((item) => typeof item.current_a === 'object' && item.current_a !== null)) {
    const currentData = data.filter((item) => typeof item.current_a === 'object' && item.current_a !== null)
    if (currentData.length > 0) {
      const currentFields: Array<keyof CurrentStats> = ['min', 'avg', 'max']
      const currentResult: CurrentStats = {}

      currentFields.forEach((field) => {
        const values = currentData
          .map((item) => {
            const stats = item.current_a as CurrentStats | undefined
            const value = stats?.[field]
            return isNumber(value) ? value : undefined
          })
          .filter((value): value is number => value !== undefined)

        if (values.length === 0) return

        switch (method) {
          case 'average':
            currentResult[field] = values.reduce((a, b) => a + b, 0) / values.length
            break
          case 'max':
            currentResult[field] = Math.max(...values)
            break
          case 'min':
            currentResult[field] = Math.min(...values)
            break
          case 'latest':
            currentResult[field] = values[values.length - 1]
            break
          default:
            currentResult[field] = values[values.length - 1]
            break
        }
      })

      if (Object.keys(currentResult).length > 0) {
        result.current_a = currentResult
      }
    }
  }

  if (data.some((item) => item.accel)) {
    const accelData = data.filter((item) => item.accel)
    if (accelData.length > 0) {
      const accelFields: Array<keyof AccelVector> = ['x', 'y', 'z']
      const accelResult: AccelVector = {}

      accelFields.forEach((field) => {
        const values = accelData
          .map((item) => item.accel?.[field])
          .filter((value): value is number => isNumber(value))

        if (values.length === 0) return

        switch (method) {
          case 'average':
            accelResult[field] = values.reduce((a, b) => a + b, 0) / values.length
            break
          case 'max':
            accelResult[field] = Math.max(...values)
            break
          case 'min':
            accelResult[field] = Math.min(...values)
            break
          case 'latest':
            accelResult[field] = values[values.length - 1]
            break
          default:
            accelResult[field] = values[values.length - 1]
            break
        }
      })

      if (Object.keys(accelResult).length > 0) {
        result.accel = accelResult
      }
    }
  }

  return result
}

/**
 * Normalize incoming raw records from various sources (IoT Core, Timestream, etc.)
 * to the shape expected by charts and downsampling.
 */
export function normalizeRawData(input: unknown[]): RawDataItem[] {
  return input
    .filter(isRecord)
    .map((record) => normalizeRawItem(record))
}

export function normalizeRawItem(rec: Record<string, unknown>): RawDataItem {
  const parsePayload = (value: unknown): Record<string, unknown> | undefined => {
    if (!value) return undefined
    if (isRecord(value)) return value
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return isRecord(parsed) ? parsed : undefined
      } catch {
        return undefined
      }
    }
    return undefined
  }

  const payload = parsePayload(rec['payload'])

  const pickValue = (...keys: string[]): unknown => {
    for (const key of keys) {
      if (rec[key] !== undefined) return rec[key]
      if (payload && payload[key] !== undefined) return payload[key]
    }
    return undefined
  }

  // Normalize timestamp: accepts ISO string, epoch seconds (10 digits), or epoch ms (13 digits)
  const toEpochMs = (ts: unknown): number => {
    if (ts === null || ts === undefined) return Date.now()
    if (typeof ts === 'number') {
      return ts < 1_000_000_000_000 ? ts * 1000 : ts
    }
    const s = String(ts).trim()
    if (/^\d+$/.test(s)) {
      if (s.length === 10) return parseInt(s, 10) * 1000
      if (s.length === 13) return parseInt(s, 10)
      const n = parseInt(s, 10)
      return n < 1_000_000_000_000 ? n * 1000 : n
    }
    const d = new Date(s)
    const ms = d.getTime()
    return Number.isFinite(ms) ? ms : Date.now()
  }

  const toNumeric = (value: unknown): number | undefined => {
    if (value === null || value === undefined) return undefined
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return undefined
      let normalized = trimmed
      if (trimmed.includes('.') && trimmed.includes(',')) {
        normalized = trimmed.replace(/,/g, '')
      } else if (!trimmed.includes('.') && trimmed.includes(',')) {
        normalized = trimmed.replace(/,/g, '.')
      } else {
        normalized = trimmed.replace(/,/g, '')
      }
      const n = Number(normalized)
      return Number.isFinite(n) ? n : undefined
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0
    }
    return undefined
  }

  const toBinary = (value: unknown): number | undefined => {
    if (value === undefined || value === null) return undefined
    if (typeof value === 'boolean') return value ? 1 : 0
    if (typeof value === 'number') return value === 0 ? 0 : 1
    const str = String(value).trim().toLowerCase()
    if (str === '' || str === 'null') return undefined
    if (['0', 'false', 'no', 'off'].includes(str)) return 0
    if (['1', 'true', 'yes', 'on'].includes(str)) return 1
    return 1
  }

  const tsMs = toEpochMs(rec.timestamp)
  const timestampIso = new Date(tsMs).toISOString()

  // Voltage / current / temp
  const voltage_v = toNumeric(pickValue('voltage_v', 'voltage_V'))
  const currentSrc = pickValue('current_a', 'current_A')
  const currentParsed = typeof currentSrc === 'object' && currentSrc !== null
    ? {
        min: toNumeric(isRecord(currentSrc) ? currentSrc['min'] : undefined),
        avg: toNumeric(isRecord(currentSrc) ? currentSrc['avg'] : undefined),
        max: toNumeric(isRecord(currentSrc) ? currentSrc['max'] : undefined),
      }
    : toNumeric(currentSrc)
  const temperature_c = toNumeric(pickValue('temperature_c', 'temp_C'))

  // Accel (flattened + nested)
  const accelSrc = isRecord(rec['accel'])
    ? rec['accel']
    : isRecord(payload?.['accel'])
      ? (payload?.['accel'] as Record<string, unknown>)
      : undefined

  const ax = toNumeric(pickValue('accel_x', 'accel_x_raw')) ?? toNumeric(accelSrc?.['x'])
  const ay = toNumeric(pickValue('accel_y', 'accel_y_raw')) ?? toNumeric(accelSrc?.['y'])
  const az = toNumeric(pickValue('accel_z', 'accel_z_raw')) ?? toNumeric(accelSrc?.['z'])

  // GNSS fields
  const gnssSrc = isRecord(rec['gnss'])
    ? rec['gnss']
    : isRecord(payload?.['gnss'])
      ? (payload?.['gnss'] as Record<string, unknown>)
      : undefined

  const lat = toNumeric(pickValue('lat', 'gnss_lat', 'latitude')) ?? toNumeric(gnssSrc?.['lat'])
  const lon = toNumeric(pickValue('lon', 'gnss_lon', 'longitude')) ?? toNumeric(gnssSrc?.['lon'])
  const alt_m = toNumeric(pickValue('alt_m', 'gnss_alt_m', 'alt'))
  const speed_m_s = toNumeric(pickValue('speed_m_s', 'gnss_speed'))
  const speed_kmh = toNumeric(pickValue('speed_kmh')) ?? (typeof speed_m_s === 'number' ? speed_m_s * 3.6 : undefined)
  const heading_deg = toNumeric(pickValue('heading_deg', 'gnss_heading'))
  const quality_avg = toNumeric(pickValue('quality_avg', 'hdop', 'gnss_quality'))

  // Power: use provided or compute
  const currentNumeric = typeof currentParsed === 'number'
    ? currentParsed
    : (currentParsed && typeof currentParsed.avg === 'number'
        ? currentParsed.avg
        : undefined)
  const power_kw = toNumeric(pickValue('power_kw')) ?? (
    typeof voltage_v === 'number' && typeof currentNumeric === 'number'
      ? (voltage_v * currentNumeric) / 1000.0
      : undefined
  )

  // Flags -> normalize to 0/1
  const lte_ok: number | undefined = toBinary(pickValue('lte_ok'))
  const gnss_ok: number | undefined = toBinary(
    pickValue('gnss_ok', 'gnss_fix') ?? (isRecord(rec['extra']) ? rec['extra']?.['gnss_fix'] : undefined)
  )

  const out: RawDataItem = {
    deviceID: String(rec['deviceID'] ?? '') || '',
    timestamp: timestampIso,
  }

  if (typeof voltage_v === 'number') out.voltage_v = voltage_v
  if (typeof currentParsed === 'number') {
    out.current_a = currentParsed
  } else if (currentParsed && typeof currentParsed === 'object') {
    const normalizedCurrent: CurrentStats = {}
    if (typeof currentParsed.min === 'number') normalizedCurrent.min = currentParsed.min
    if (typeof currentParsed.avg === 'number') normalizedCurrent.avg = currentParsed.avg
    if (typeof currentParsed.max === 'number') normalizedCurrent.max = currentParsed.max
    if (Object.keys(normalizedCurrent).length > 0) {
      out.current_a = normalizedCurrent
    }
  }
  if (typeof temperature_c === 'number') out.temperature_c = temperature_c
  if (typeof power_kw === 'number') out.power_kw = power_kw
  if (typeof lte_ok === 'number') out.lte_ok = lte_ok
  if (typeof gnss_ok === 'number') out.gnss_ok = gnss_ok

  if (typeof ax === 'number') out.accel_x = ax
  if (typeof ay === 'number') out.accel_y = ay
  if (typeof az === 'number') out.accel_z = az
  if (ax !== undefined || ay !== undefined || az !== undefined) {
    const accel: AccelVector = {}
    if (typeof ax === 'number') accel.x = ax
    if (typeof ay === 'number') accel.y = ay
    if (typeof az === 'number') accel.z = az
    if (Object.keys(accel).length > 0) {
      out.accel = accel
    }
  }

  if (
    lat !== undefined || lon !== undefined || alt_m !== undefined || speed_kmh !== undefined || heading_deg !== undefined || quality_avg !== undefined
  ) {
    const gnss: GnssData = {}
    if (typeof lat === 'number') gnss.lat = lat
    if (typeof lon === 'number') gnss.lon = lon
    if (typeof alt_m === 'number') gnss.alt_m = alt_m
    if (typeof speed_kmh === 'number') gnss.speed_kmh = speed_kmh
    if (typeof heading_deg === 'number') gnss.heading_deg = heading_deg
    if (typeof quality_avg === 'number') gnss.quality_avg = quality_avg
    if (Object.keys(gnss).length > 0) {
      out.gnss = gnss
    }

    if (typeof lat === 'number') out.lat = lat
    if (typeof lon === 'number') out.lon = lon
    if (typeof alt_m === 'number') out.alt_m = alt_m
    if (typeof heading_deg === 'number') out.heading_deg = heading_deg
    if (typeof speed_kmh === 'number') out.speed_kmh = speed_kmh
    if (typeof quality_avg === 'number') out.quality_avg = quality_avg
  }

  const knownKeys = new Set<string>([
    'deviceID',
    'timestamp',
    'payload',
    'voltage_v',
    'voltage_V',
    'current_a',
    'current_A',
    'temperature_c',
    'temp_C',
    'accel',
    'accel_x',
    'accel_y',
    'accel_z',
    'accel_x_raw',
    'accel_y_raw',
    'accel_z_raw',
    'lat',
    'lon',
    'alt',
    'alt_m',
    'gnss_lat',
    'gnss_lon',
    'gnss_alt_m',
    'speed_m_s',
    'speed_kmh',
    'gnss_speed',
    'heading_deg',
    'gnss_heading',
    'quality_avg',
    'gnss_quality',
    'hdop',
    'lte_ok',
    'gnss_ok',
    'gnss_fix',
    'power_kw',
  ])

  if (payload) {
    const extra: Record<string, unknown> = {}
    Object.entries(payload).forEach(([key, value]) => {
      if (!knownKeys.has(key) && value !== undefined && value !== null) {
        extra[key] = value
      }
    })
    if (Object.keys(extra).length > 0) {
      (out as Record<string, unknown>).extra = extra
    }
  }

  return out
}

// Field units mapping for CSV headers
const CSV_FIELD_UNITS: Record<string, string> = {
  voltage_v: "V",
  current_a: "A",
  temperature_c: "°C",
  speed_kmh: "km/h",
  power_kw: "kW",
  lat: "°",
  lon: "°",
  alt_m: "m",
  heading_deg: "°",
  quality_min: "",
  quality_avg: "",
  accel_x: "g",
  accel_y: "g",
  accel_z: "g",
  lte_ok: "",
  gnss_ok: "",
  min: "A",
  avg: "A",
  max: "A",
};

/**
 * Converts data to CSV format for download
 */
export function dataToCSV(data: RawDataItem[]): string {
  if (data.length === 0) return ''

  // Get all possible fields from the data
  const allFields = new Set<string>()
  data.forEach(item => {
    Object.keys(item).forEach(key => {
      if (key === 'deviceID' || key === 'timestamp') return
      if (key === 'gnss' || key === 'extra') return
      allFields.add(key)
    })
  })

  const fields = ['deviceID', 'timestamp', ...Array.from(allFields).sort()]
  
  // Create CSV header with units
  const headerFields = fields.map(field => {
    if (field === 'deviceID') return 'deviceID'
    if (field === 'timestamp') return 'timestamp (UTC)'
    
    const unit = CSV_FIELD_UNITS[field] || ''
    return `${field}${unit ? ` (${unit})` : ''}`
  })
  const header = headerFields.join(',')
  
  // Create CSV rows
  const rows = data.map(item => {
    const record = item as Record<string, unknown>
    return fields.map(field => {
      if (field === 'deviceID') return `"${item.deviceID}"`
      if (field === 'timestamp') return `"${item.timestamp}"`

      const value = record[field]
      if (value === undefined || value === null) return ''

      if (isRecord(value)) {
        if (
          field === 'accel' &&
          isNumber(value['x']) &&
          isNumber(value['y']) &&
          isNumber(value['z'])
        ) {
          return `"${value['x']},${value['y']},${value['z']}"`
        }
        const jsonStr = JSON.stringify(value)
        if (field.startsWith('accel_') || field === 'accel') {
          return `"${jsonStr.replace(/[{}]/g, '')}"`
        }
        return `"${jsonStr}"`
      }

      if (Array.isArray(value)) {
        return `"${JSON.stringify(value)}"`
      }

      return `"${String(value)}"`
    }).join(',')
  })

  return [header, ...rows].join('\n')
} 
