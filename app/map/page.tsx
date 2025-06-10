"use client"

import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import dynamic from "next/dynamic"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { DeviceData } from "../components/VehicleMap"
import DashboardLayout from "../components/dashboard-layout"

const VehicleMap = dynamic(() => import("../components/VehicleMap"), { ssr: false })

export default function MapPage() {
  const auth = useAuth()
  const [devices, setDevices] = useState<DeviceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(30)

  const fetchDevices = async () => {
    try {
      setLoading(true)
      setError("")

      const response = await fetch("/api/gnsstime", {
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
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vehicle Map</h1>
            <p className="text-muted-foreground">Track and monitor your fleet in real-time</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <Label htmlFor="auto-refresh">Auto Refresh</Label>
            </div>
            {autoRefresh && (
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  min={5}
                  max={300}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">sec</span>
              </div>
            )}
            <Button onClick={fetchDevices} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Live Vehicle Locations</CardTitle>
            <CardDescription>Real-time positions of {devices.length} vehicles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[500px] w-full rounded-md border">
              {loading && devices.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="mt-4 text-muted-foreground">Loading vehicle locations...</p>
                  </div>
                </div>
              ) : (
                <VehicleMap devices={devices} />
              )}
            </div>
          </CardContent>
        </Card>

        {devices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Vehicles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{devices.length}</div>
                <p className="text-xs text-muted-foreground">Active in fleet</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Good Battery</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{devices.filter((d) => d.soc > 20).length}</div>
                <p className="text-xs text-muted-foreground">SoC above 20%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Low Battery</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">{devices.filter((d) => d.soc <= 20).length}</div>
                <p className="text-xs text-muted-foreground">SoC below 20%</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
