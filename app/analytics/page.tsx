"use client"

import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import DashboardLayout from "../components/layout/DashboardLayout"
import TimeRangeSelector, { type TimeRange } from "../components/TimeRangeSelector"
import DeviceSelector from "../components/DeviceSelector"
import { Bar, Doughnut } from "react-chartjs-2"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from "chart.js"

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

export default function AnalyticsPage() {
  const auth = useAuth()

  // State for filters
  const [timeRange, setTimeRange] = useState<TimeRange>("7d")
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [selectedDevices, setSelectedDevices] = useState<string[]>(["all"])

  // State for data
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [analyticsData, setAnalyticsData] = useState<any>({})

  // Sample device IDs
  const deviceIds = ["Bus-101", "Bus-202", "Bus-303", "Bus-404", "Bus-505"]

  // Generate sample analytics data
  useEffect(() => {
    if (!auth.isAuthenticated) return

    setLoading(true)

    // Simulate API call with timeout
    setTimeout(() => {
      // Sample data for charts
      const efficiencyData = {
        labels: deviceIds,
        datasets: [
          {
            label: "Average Efficiency (%)",
            data: deviceIds.map(() => Math.floor(Math.random() * 30) + 70), // 70-100%
            backgroundColor: "rgba(54, 162, 235, 0.5)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1,
          },
        ],
      }

      const batteryUsageData = {
        labels: ["0-20%", "21-40%", "41-60%", "61-80%", "81-100%"],
        datasets: [
          {
            label: "Battery Level Distribution",
            data: [5, 10, 15, 30, 40],
            backgroundColor: [
              "rgba(255, 99, 132, 0.5)",
              "rgba(255, 159, 64, 0.5)",
              "rgba(255, 205, 86, 0.5)",
              "rgba(75, 192, 192, 0.5)",
              "rgba(54, 162, 235, 0.5)",
            ],
            borderColor: [
              "rgb(255, 99, 132)",
              "rgb(255, 159, 64)",
              "rgb(255, 205, 86)",
              "rgb(75, 192, 192)",
              "rgb(54, 162, 235)",
            ],
            borderWidth: 1,
          },
        ],
      }

      const dailyUsageData = {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [
          {
            label: "Average Daily Usage (kWh)",
            data: [65, 59, 80, 81, 56, 40, 30],
            backgroundColor: "rgba(75, 192, 192, 0.5)",
            borderColor: "rgba(75, 192, 192, 1)",
            borderWidth: 1,
          },
        ],
      }

      const summaryStats = {
        totalVehicles: deviceIds.length,
        activeVehicles: Math.floor(Math.random() * 3) + 3, // 3-5
        avgEfficiency: Math.floor(Math.random() * 10) + 85, // 85-95%
        totalDistance: Math.floor(Math.random() * 1000) + 2000, // 2000-3000 km
        energyUsed: Math.floor(Math.random() * 500) + 1500, // 1500-2000 kWh
        co2Saved: Math.floor(Math.random() * 300) + 700, // 700-1000 kg
      }

      setAnalyticsData({
        efficiencyData,
        batteryUsageData,
        dailyUsageData,
        summaryStats,
      })

      setLoading(false)
    }, 1500)
  }, [auth.isAuthenticated, timeRange, selectedDevices])

  // Update date range based on selected timeRange
  useEffect(() => {
    if (timeRange !== "custom") {
      const now = new Date()
      let newStart: Date | null = null

      switch (timeRange) {
        case "24hr":
          newStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case "7d":
          newStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case "1m":
          newStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
          break
        case "1y":
          newStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
          break
        case "all":
        default:
          newStart = new Date(2020, 0, 1) // Some reasonable default for "all"
      }

      setStartDate(newStart)
      setEndDate(now)
    }
  }, [timeRange])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters */}
          <div className="lg:col-span-1">
            <TimeRangeSelector
              timeRange={timeRange}
              setTimeRange={setTimeRange}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
            />

            <DeviceSelector
              devices={deviceIds}
              selectedDevices={selectedDevices}
              setSelectedDevices={setSelectedDevices}
            />
          </div>

          {/* Analytics Content */}
          <div className="lg:col-span-3 space-y-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {analyticsData.summaryStats && (
                    <>
                      <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-gray-500">Total Vehicles</h3>
                        <p className="text-2xl font-bold text-gray-900">{analyticsData.summaryStats.totalVehicles}</p>
                      </div>

                      <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-gray-500">Active Vehicles</h3>
                        <p className="text-2xl font-bold text-gray-900">{analyticsData.summaryStats.activeVehicles}</p>
                      </div>

                      <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-gray-500">Avg. Efficiency</h3>
                        <p className="text-2xl font-bold text-gray-900">{analyticsData.summaryStats.avgEfficiency}%</p>
                      </div>

                      <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-gray-500">Total Distance</h3>
                        <p className="text-2xl font-bold text-gray-900">
                          {analyticsData.summaryStats.totalDistance} km
                        </p>
                      </div>

                      <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-gray-500">Energy Used</h3>
                        <p className="text-2xl font-bold text-gray-900">{analyticsData.summaryStats.energyUsed} kWh</p>
                      </div>

                      <div className="bg-white p-4 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-gray-500">CO2 Saved</h3>
                        <p className="text-2xl font-bold text-gray-900">{analyticsData.summaryStats.co2Saved} kg</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Efficiency Chart */}
                  <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">Vehicle Efficiency</h3>
                    {analyticsData.efficiencyData && (
                      <Bar
                        data={analyticsData.efficiencyData}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              position: "top",
                            },
                            title: {
                              display: false,
                            },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              max: 100,
                            },
                          },
                        }}
                      />
                    )}
                  </div>

                  {/* Battery Usage Chart */}
                  <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">Battery Level Distribution</h3>
                    {analyticsData.batteryUsageData && (
                      <div className="flex justify-center" style={{ height: "300px" }}>
                        <Doughnut
                          data={analyticsData.batteryUsageData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: "bottom",
                              },
                            },
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Daily Usage Chart */}
                  <div className="bg-white p-4 rounded-lg shadow md:col-span-2">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">Daily Energy Usage</h3>
                    {analyticsData.dailyUsageData && (
                      <Bar
                        data={analyticsData.dailyUsageData}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              position: "top",
                            },
                            title: {
                              display: false,
                            },
                          },
                        }}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
