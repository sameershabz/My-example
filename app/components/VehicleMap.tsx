"use client"

import { useEffect, useRef, useState } from "react"
import type { Map as LeafletMap, LayerGroup } from "leaflet"
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

declare global {
  interface Window {
    L?: typeof import("leaflet")
  }
}

function MapComponent({ devices }: VehicleMapProps) {
  const DISPLAY_TIMEZONE = "Africa/Johannesburg"
  const mapRef = useRef<LeafletMap | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const markerGroupRef = useRef<LayerGroup | null>(null)

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
    const initMap = async () => {
      try {
        const leaflet = await import("leaflet")
        window.L = leaflet

        const iconProto = leaflet.Icon.Default.prototype as unknown as { _getIconUrl?: unknown }
        delete iconProto._getIconUrl
        leaflet.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        })

        if (containerRef.current && !mapRef.current) {
          mapRef.current = leaflet.map(containerRef.current, {
            center: devices.length > 0 ? [devices[0].latitude, devices[0].longitude] : [20, 0],
            zoom: devices.length === 1 ? 10 : 2,
            scrollWheelZoom: true,
          })

          leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
          }).addTo(mapRef.current)

          markerGroupRef.current = leaflet.layerGroup().addTo(mapRef.current)
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
        } catch (error) {
          console.warn("Map cleanup error:", error)
        }
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !window.L) return
    const leaflet = window.L
    const map = mapRef.current
    const markerGroup = markerGroupRef.current
    if (!markerGroup) return

    markerGroup.clearLayers()
    devices.forEach((device) => {
      const tsMs = toEpochMs(device.timestamp)
      const marker = leaflet.marker([device.latitude, device.longitude]).bindPopup(`
        <div style="color:#000;">
          <strong style="color:#000;">${device.deviceId}</strong><br/>
          Timestamp: ${new Date(tsMs).toLocaleString(undefined, { timeZone: DISPLAY_TIMEZONE, hour12: false })}<br/>
          Lat: ${device.latitude.toFixed(5)}<br/>
          Lon: ${device.longitude.toFixed(5)}<br/>
          SoC: ${device.soc}%<br/>
          Efficiency: ${device.efficiency.toFixed(1)} km/kWh
        </div>
      `)
      marker.addTo(markerGroup)
    })

    if (devices.length > 1) {
      const bounds = devices.map((d) => [d.latitude, d.longitude] as [number, number])
      try {
        map.fitBounds(bounds, { padding: [20, 20] })
      } catch (error) {
        console.warn("Error fitting bounds:", error)
      }
    } else if (devices.length === 1) {
      map.setView([devices[0].latitude, devices[0].longitude], 10)
    }

    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize()
      }
    }, 100)
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
