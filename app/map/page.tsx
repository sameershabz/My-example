"use client"

import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import dynamic from "next/dynamic"
import DashboardLayout from "../components/layout/DashboardLayout"
import { sampleDevices } from "../components/sampleDevices"
import { Loader2, RefreshCw } from "lucide-react"

// Import VehicleMap dynamically to avoid SSR issues with Leaflet
const VehicleMap = dynamic(() => import("../components/VehicleMap"), { ssr: false })

export default function MapPage() {
  const auth = useAuth()
  const [latestData, setLatestData] = useState<any[]>([])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(10)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const API_LATEST_URL = "/api/GNSSTime"

  const fetchLatestData = async () => {
    if (!auth.isAuthenticated) return

    setRefreshing(true)
    setError("")

    try {
      const res = await fetch(API_LATEST_URL, { credentials: "include" })

      if (!res.ok) {
        throw new Error(`API Error: ${res.status}`)
      }

      const raw = await res.json()
      const mapped = raw.map((item: any) => ({
        deviceId: item.deviceID,
        latitude: item.gnss?.lat ?? 0,
        longitude: item.gnss?.lon ?? 0,
        timestamp: item.timestamp,
        soc: item.soc ?? 0,
        efficiency: item.efficiency ?? 0,
      }))

      setLatestData(mapped)
    } catch (err) {
      console.error("Fetching latest locations failed:", err)
      setError("Failed to fetch location data. Using sample data instead.")
      // If API fails, use sample data for demo purposes
      setLatestData(sampleDevices)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!auth.isAuthenticated) return

    fetchLatestData()

    let interval: ReturnType<typeof setInterval>
    if (autoRefresh) {
      interval = setInterval(fetchLatestData, refreshIntervalSec * 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [auth.isAuthenticated, autoRefresh, refreshIntervalSec])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <h1 className="text-2xl font-bold text-gray-900">Vehicle Map</h1>
          <div className="flex items-center gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Auto refresh</span>
            </label>

            {autoRefresh && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={refreshIntervalSec}
                  min={5}
                  onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
                  className="w-16 p-1 border border-gray-300 rounded text-sm"
                />
                <span className="text-sm text-gray-700">sec</span>
              </div>
            )}

            <button
              onClick={fetchLatestData}
              disabled={refreshing}
              className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white transition-colors"
            >
              {refreshing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Refresh Map
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="h-[calc(100vh-200px)]">
            <VehicleMap devices={latestData} centerOnDevices={true} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Vehicle Status</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Device ID
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Last Updated
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Battery
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Efficiency
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Location
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {latestData.map((device) => (
                  <tr key={device.deviceId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{device.deviceId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(device.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2.5 mr-2">
                          <div
                            className={`h-2.5 rounded-full ${
                              device.soc > 70 ? "bg-green-500" : device.soc > 30 ? "bg-yellow-500" : "bg-red-500"
                            }`}
                            style={{ width: `${device.soc}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-700">{device.soc}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{device.efficiency}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {device.latitude.toFixed(5)}, {device.longitude.toFixed(5)}
                    </td>
                  </tr>
                ))}
                {latestData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No vehicle data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
