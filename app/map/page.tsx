"use client"

import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import dynamic from "next/dynamic"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import type { DeviceData } from "../components/VehicleMap"

const VehicleMap = dynamic(() => import("../components/VehicleMap"), { ssr: false })

export default function MapPage() {
  const auth = useAuth()
  const [devices, setDevices] = useState<DeviceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(30)

  // Show loading state while auth is initializing
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-700">Loading map...</p>
        </div>
      </div>
    )
  }

  // Show error if auth failed
  if (auth.error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Authentication error: {auth.error.message}</p>
        </div>
      </div>
    )
  }

  // Redirect to signin if not authenticated
  if (!auth.isAuthenticated || !auth.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700">Please sign in to view the map.</p>
        </div>
      </div>
    )
  }

  const fetchDevices = async () => {
    try {
      setLoading(true)
      setError("")

      const response = await fetch("/api/GNSSTime", {
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch devices: ${response.status}`)
      }

      const data = await response.json()
      const mapped: DeviceData[] = Array.isArray(data)
        ? data.map((item: any) => ({
            deviceId: item.deviceID || item.deviceId || "Unknown",
            latitude: item.gnss?.lat || item.latitude || 0,
            longitude: item.gnss?.lon || item.longitude || 0,
            timestamp: item.timestamp || new Date().toISOString(),
            soc: item.soc || 0,
            efficiency: item.efficiency || 0,
          }))
        : []

      setDevices(mapped)
    } catch (err) {
      console.error("Fetch devices error:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch device locations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      fetchDevices()
    }
  }, [auth.isAuthenticated, auth.user])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (autoRefresh && auth.isAuthenticated) {
      interval = setInterval(fetchDevices, refreshInterval * 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, auth.isAuthenticated])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Vehicle Map</h1>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span>Auto Refresh</span>
          </label>
          {autoRefresh && (
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                min={5}
                max={300}
                className="w-20 px-2 py-1 border rounded"
              />
              <span>sec</span>
            </div>
          )}
          <Button onClick={fetchDevices} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Live Vehicle Locations</CardTitle>
          <CardDescription>Real-time positions of {devices.length} vehicles</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && devices.length === 0 ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                <p className="mt-4 text-gray-700">Loading vehicle locations...</p>
              </div>
            </div>
          ) : (
            <div className="h-96">
              <VehicleMap devices={devices} />
            </div>
          )}
        </CardContent>
      </Card>

      {devices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Status Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{devices.length}</div>
                <div className="text-sm text-gray-600">Total Vehicles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{devices.filter((d) => d.soc > 20).length}</div>
                <div className="text-sm text-gray-600">Good Battery</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{devices.filter((d) => d.soc <= 20).length}</div>
                <div className="text-sm text-gray-600">Low Battery</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
