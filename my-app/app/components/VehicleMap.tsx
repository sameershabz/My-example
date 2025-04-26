"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface DeviceData {
  deviceId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  efficiency: number;
  soc: number;
}

interface VehicleMapProps {
  devices: DeviceData[];
}

export default function VehicleMap({ devices }: VehicleMapProps) {
  if (devices.length === 0) {
    return (
      <div className="text-center text-white py-20">
        No location data available.
      </div>
    );
  }
  const mapRef = useRef<LeafletMap | null>(null);
  // Force a unique key if needed during hot reload
  const [mapKey] = useState(Date.now());

  // Cleanup on unmount: remove event listeners & the map

  // Reset container's leaflet id on mount to avoid "already initialized" error.
  useEffect(() => {
    const container = document.getElementById("mapid");
    if (container && (container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.off();
        mapRef.current.remove();
      }
    };
  }, []);

  const handleMapReady = (mapEvent: any) => {
    // mapEvent is a Leaflet Event; the actual map instance is mapEvent.target
    mapRef.current = mapEvent.target;
  };

  return (
    <div style={{ width: "100%", height: "600px" }}>
        <MapContainer
          key={mapKey}
          center={[20, 0]}
          zoom={2}
          scrollWheelZoom
          style={{ width: "100%", height: "100%" }}
        >

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {devices.map((d) => (
          <Marker key={d.deviceId} position={[Number(d.latitude), Number(d.longitude)]}>
            <Popup>
              <div>
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
  );
}

