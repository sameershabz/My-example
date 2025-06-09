"use client"

import { useEffect, useRef, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import type { Map as LeafletMap } from "leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Battery, Zap, Navigation } from "lucide-react"

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// Custom marker icons based on vehicle status
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

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
  centerOnDevices?: boolean
}

// Component to handle map bounds
function MapBoundsHandler({ devices }: { devices: DeviceData[] }) {
  const map = useMap()

  useEffect(() => {
    if (devices.length > 0) {
      const bounds = L.latLngBounds(devices.map((d) => [Number(d.latitude), Number(d.longitude)]))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [devices, map])

  return null
}

export default function VehicleMap({ devices, centerOnDevices = true }: VehicleMapProps) {
  const mapRef = useRef<LeafletMap | null>(null)
  const [mapKey] = useState(Date.now())

  // Reset container's leaflet id on mount to avoid "already initialized" error.
  useEffect(() => {
    const container = document.getElementById("mapid")
    if (container && (container as any)._leaflet_id) {
      ;(container as any)._leaflet_id = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.off()
        mapRef.current.remove()
      }
    }
  }, [])

  const handleMapReady = (map: LeafletMap) => {
    mapRef.current = map
  }

  if (devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow">
        <div className="text-center">
          <p className="text-gray-600">No location data available</p>
          <p className="text-sm text-gray-500 mt-2">Check your connection or try again later</p>
        </div>
      </div>
    )
  }

  // Get marker color based on battery level
  const getMarkerColor = (soc: number) => {
    if (soc >= 70) return "#4ade80" // Green for high battery
    if (soc >= 30) return "#facc15" // Yellow for medium battery
    return "#f87171" // Red for low battery
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="h-[600px]">
        <MapContainer
          key={mapKey}
          center={[20, 0]}
          zoom={2}
          scrollWheelZoom
          style={{ width: "100%", height: "100%" }}
          whenReady={(e) => handleMapReady(e.target)}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {devices.map((d) => (
            <Marker
              key={d.deviceId}
              position={[Number(d.latitude), Number(d.longitude)]}
              icon={createCustomIcon(getMarkerColor(d.soc))}
            >
              <Popup className="vehicle-popup">
                <div className="p-1">
                  <h3 className="font-bold text-lg mb-2">{d.deviceId}</h3>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center">
                      <Battery className="h-4 w-4 mr-1 text-blue-500" />
                      <span>Battery: {d.soc}%</span>
                    </div>

                    <div className="flex items-center">
                      <Zap className="h-4 w-4 mr-1 text-yellow-500" />
                      <span>Efficiency: {d.efficiency}%</span>
                    </div>

                    <div className="flex items-center">
                      <Navigation className="h-4 w-4 mr-1 text-gray-500" />
                      <span>
                        {Number(d.latitude).toFixed(5)}, {Number(d.longitude).toFixed(5)}
                      </span>
                    </div>

                    <div className="col-span-2 text-xs text-gray-500 mt-1">
                      Last updated: {new Date(d.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {centerOnDevices && <MapBoundsHandler devices={devices} />}
        </MapContainer>
      </div>
    </div>
  )
}
