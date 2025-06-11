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

// Create a simple map component that doesn't reuse containers
function MapComponent({ devices }: VehicleMapProps) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mapInstance, setMapInstance] = useState<any>(null)

  useEffect(() => {
    let map: any = null
    let L: any = null

    const initMap = async () => {
      try {
        // Dynamic import of leaflet to avoid SSR issues
        const leaflet = await import("leaflet")
        L = leaflet.default

        // Fix default markers
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        })

        if (containerRef.current && !mapInstance) {
          // Create map with unique container
          map = L.map(containerRef.current, {
            center: devices.length > 0 ? [devices[0].latitude, devices[0].longitude] : [20, 0],
            zoom: devices.length === 1 ? 10 : 2,
            scrollWheelZoom: true,
          })

          // Add tile layer
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
          }).addTo(map)

          setMapInstance(map)
          mapRef.current = map
        }
      } catch (error) {
        console.error("Error initializing map:", error)
      }
    }

    initMap()

    // Cleanup function
    return () => {
      if (map) {
        try {
          map.remove()
        } catch (e) {
          console.warn("Map cleanup error:", e)
        }
      }
      if (mapRef.current) {
        try {
          mapRef.current.remove()
        } catch (e) {
          console.warn("Map ref cleanup error:", e)
        }
      }
      setMapInstance(null)
    }
  }, []) // Only run once on mount

  // Update markers when devices change
  useEffect(() => {
    if (!mapInstance || !window.L) return

    const L = window.L

    // Clear existing markers
    mapInstance.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        mapInstance.removeLayer(layer)
      }
    })

    // Add new markers
    devices.forEach((device) => {
      const marker = L.marker([device.latitude, device.longitude]).addTo(mapInstance)
      marker.bindPopup(`
        <div>
          <strong>${device.deviceId}</strong><br/>
          Timestamp: ${new Date(device.timestamp).toLocaleString()}<br/>
          Lat: ${device.latitude.toFixed(5)}<br/>
          Lon: ${device.longitude.toFixed(5)}<br/>
          SoC: ${device.soc}%<br/>
          Efficiency: ${device.efficiency}%
        </div>
      `)
    })

    // Fit bounds if multiple devices
    if (devices.length > 1) {
      const bounds = devices.map((d) => [d.latitude, d.longitude])
      try {
        mapInstance.fitBounds(bounds, { padding: [20, 20] })
      } catch (e) {
        console.warn("Error fitting bounds:", e)
      }
    }
  }, [devices, mapInstance])

  if (devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 text-gray-600 rounded-lg">
        <p>No location data available.</p>
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full rounded-lg" />
}

// Export with dynamic loading to prevent SSR issues
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
