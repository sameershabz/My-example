"use client";

import React, { useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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

function MapReadyHandler({ onMap }: { onMap: (map: LeafletMap) => void }) {
  const map = useMap();
  React.useEffect(() => {
    onMap(map);
  }, [map, onMap]);
  return null;
}

export default function VehicleMap({ devices }: VehicleMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);

  const handleMapLoad = (map: LeafletMap) => {
    mapRef.current = map;
  };

  return (
    <div style={{ width: "100%", height: "600px" }}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
      >
        <MapReadyHandler onMap={handleMapLoad} />
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {devices.map((d) => (
          <Marker key={d.deviceId} position={[d.latitude, d.longitude]}>
            <Popup>
              <div>
                <strong>{d.deviceId}</strong>
                <br />
                {new Date(d.timestamp).toLocaleString()}
                <br />
                Lat/Lon: {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
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
