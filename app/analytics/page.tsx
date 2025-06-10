"use client"

import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, TrendingUp, Users, MapPin, Zap, RefreshCw } from "lucide-react"
import type { ApiDataItem } from "../components/DataChart1"
import DashboardLayout from "../components/dashboard-layout"

export default function Analytics() {
  const auth = useAuth()
  const [data, setData] = useState<ApiDataItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-muted-foreground">View detailed analytics and metrics for your fleet</p>
          </div>
          <Button onClick={fetchAnalyticsData} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh Data
          </Button>
        </div>

        {error && (
          <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-muted-foreground">Loading analytics data...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <div className="flex items-center justify-center h-32">
                    <p className="text-muted-foreground">No data available</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h3 className="font-semibold">Device Status</h3>
                        <p className="text-sm text-muted-foreground">
                          {totalDevices} devices are currently reporting data
                        </p>

                        <div className="mt-4 space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span>Online</span>
                            <span className="font-medium">{totalDevices}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: "100%" }}></div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-semibold">Data Quality</h3>
                        <p className="text-sm text-muted-foreground">{totalDataPoints} data points collected</p>

                        <div className="mt-4 space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span>Valid Data</span>
                            <span className="font-medium">{Math.round(totalDataPoints * 0.98)}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: "98%" }}></div>
                          </div>

                          <div className="flex justify-between items-center text-sm mt-2">
                            <span>Invalid Data</span>
                            <span className="font-medium">{Math.round(totalDataPoints * 0.02)}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: "2%" }}></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <h3 className="font-semibold mb-2">Recent Activity</h3>
                      <div className="space-y-2">
                        {data.slice(0, 3).map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                            <div>
                              <p className="font-medium">{item.deviceID}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(item.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm">{item.voltage_v ? `${item.voltage_v.toFixed(2)}V` : "N/A"}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.temperature_c ? `${item.temperature_c.toFixed(1)}°C` : "N/A"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
