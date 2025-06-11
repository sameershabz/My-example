"use client"

import { useEffect, useRef } from "react"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import type { Map as LeafletMap } from "leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

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

export default function VehicleMap({ devices }: VehicleMapProps) {
  const mapRef = useRef<LeafletMap | null>(null)

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

  // Calculate bounds to fit all markers
  const getBounds = () => {
    if (devices.length === 0) return [[0, 0]]
    return devices.map((d) => [Number(d.latitude), Number(d.longitude)])
  }

  if (devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20">
        <p className="text-muted-foreground">No location data available.</p>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <MapContainer
        center={devices.length > 0 ? [devices[0].latitude, devices[0].longitude] : [20, 0]}
        zoom={devices.length === 1 ? 10 : 2}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
        whenReady={(map) => {
          mapRef.current = map.target
          if (devices.length > 1) {
            try {
              // @ts-ignore - TypeScript doesn't recognize fitBounds with this signature
              map.target.fitBounds(getBounds())
            } catch (e) {
              console.error("Error fitting bounds:", e)
            }
          }
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {devices.map((d) => (
          <Marker key={d.deviceId} position={[Number(d.latitude), Number(d.longitude)]}>
            <Popup>
              <div className="p-1">
                <strong>{d.deviceId}</strong>
                <br />
                Timestamp: {new Date(d.timestamp).toLocaleString()}
                <br />
                Lat: {Number(d.latitude).toFixed(5)}
                <br />
                Lon: {Number(d.longitude).toFixed(5)}
                <br />
                SoC: {d.soc}%
                <br />
                Efficiency: {d.efficiency}%
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
