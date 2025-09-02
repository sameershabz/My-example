"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"

export interface DeviceData {
  deviceId: string
  latitude: number
  longitude: number
  timestamp: string
  efficiency: number
  soc: number
}

interface VehicleMapProps {
  devices: DeviceData[]
}

function MapComponent({ devices }: VehicleMapProps) {
  // Force display timezone (UTC+8)
  const DISPLAY_TIMEZONE = "Asia/Singapore"

  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const markerGroupRef = useRef<any>(null)

  // Normalize timestamps: supports ISO strings, epoch seconds (10 digits), or epoch ms (13 digits)
  const toEpochMs = (ts: string | number): number => {
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

  useEffect(() => {
    let L: any = null

    const initMap = async () => {
      try {
        const leaflet = await import("leaflet")
        L = leaflet.default

        // Expose for other effects
        ;(window as any).L = L

        // Fix default markers
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        })

        if (containerRef.current && !mapRef.current) {
          mapRef.current = L.map(containerRef.current, {
            center:
              devices.length > 0
                ? [devices[0].latitude, devices[0].longitude]
                : [20, 0],
            zoom: devices.length === 1 ? 10 : 2,
            scrollWheelZoom: true,
          })

          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
          }).addTo(mapRef.current)

          // initialize marker group
          markerGroupRef.current = L.layerGroup().addTo(mapRef.current)
        }
      } catch (error) {
        console.error("Error initializing map:", error)
      }
    }

    initMap()

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove()
        } catch (e) {
          console.warn("Map cleanup error:", e)
        }
        mapRef.current = null
      }
    }
  }, []) // run once

  useEffect(() => {
    if (!mapRef.current || !(window as any).L) return
    const map = mapRef.current
    const L = (window as any).L
    const mg = markerGroupRef.current
    if (!mg) return

    mg.clearLayers()
    devices.forEach((device) => {
      const tsMs = toEpochMs(device.timestamp)
      const marker = L.marker([device.latitude, device.longitude]).bindPopup(`
        <div style="color:#000;">
          <strong style="color:#000;">${device.deviceId}</strong><br/>
          Timestamp: ${new Date(tsMs).toLocaleString(undefined, { timeZone: DISPLAY_TIMEZONE, hour12: false })}<br/>
          Lat: ${device.latitude.toFixed(5)}<br/>
          Lon: ${device.longitude.toFixed(5)}<br/>
          SoC: ${device.soc}%<br/>
          Efficiency: ${device.efficiency}%
        </div>
      `)
      marker.addTo(mg)
    })

    if (devices.length > 1) {
      const bounds = devices.map((d) => [d.latitude, d.longitude] as [number, number])
      try {
        map.fitBounds(bounds, { padding: [20, 20] })
      } catch (e) {
        console.warn("Error fitting bounds:", e)
      }
    } else if (devices.length === 1) {
      map.setView([devices[0].latitude, devices[0].longitude], 10) 
    }

    // This is crucial for maps in hidden tabs
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 100);

  }, [devices])

  if (devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 text-gray-600 rounded-lg">
        <p>No location data available.</p>
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full rounded-lg" />
}

export default function VehicleMap(props: VehicleMapProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 text-gray-600">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  return <MapComponent {...props} />
}
