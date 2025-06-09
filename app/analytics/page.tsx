"use client"

import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, TrendingUp, Users, MapPin, Zap } from "lucide-react"
import type { ApiDataItem } from "../components/DataChart1"

export default function Analytics() {
  const auth = useAuth()
  const [data, setData] = useState<ApiDataItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Show loading state while auth is initializing
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-700">Loading analytics...</p>
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
          <p className="text-gray-700">Please sign in to view analytics.</p>
        </div>
      </div>
    )
  }

  // Rest of the component logic...
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/query", {
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`)
      }

      const result = await response.json()
      setData(Array.isArray(result) ? result : [])
    } catch (err) {
      console.error("Analytics fetch error:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch analytics data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      fetchAnalyticsData()
    }
  }, [auth.isAuthenticated, auth.user])

  // Calculate analytics metrics
  const totalDevices = new Set(data.map((item) => item.deviceID)).size
  const totalDataPoints = data.length
  const avgVoltage = data.length > 0 ? data.reduce((sum, item) => sum + (item.voltage_v || 0), 0) / data.length : 0
  const avgTemperature =
    data.length > 0 ? data.reduce((sum, item) => sum + (item.temperature_c || 0), 0) / data.length : 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-700">Loading analytics data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <button onClick={fetchAnalyticsData} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Refresh Data
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDevices}</div>
            <p className="text-xs text-muted-foreground">Active devices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Points</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDataPoints}</div>
            <p className="text-xs text-muted-foreground">Total measurements</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Voltage</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgVoltage.toFixed(2)}V</div>
            <p className="text-xs text-muted-foreground">System voltage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Temperature</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgTemperature.toFixed(1)}°C</div>
            <p className="text-xs text-muted-foreground">System temperature</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
          <CardDescription>
            Analytics data for {totalDevices} devices with {totalDataPoints} total measurements
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No data available</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Device Status</h3>
                  <p className="text-sm text-gray-600">{totalDevices} devices are currently reporting data</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Data Quality</h3>
                  <p className="text-sm text-gray-600">{totalDataPoints} data points collected</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
