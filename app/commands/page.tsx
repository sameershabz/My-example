"use client"

import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import DashboardLayout from "../components/layout/DashboardLayout"
import CommandInterface from "../components/CommandInterface"

export default function CommandsPage() {
  const auth = useAuth()
  const [commandHistory, setCommandHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // This would be replaced with actual API call in production
  useEffect(() => {
    if (!auth.isAuthenticated) return

    setLoading(true)

    // Simulate API call with timeout
    setTimeout(() => {
      setCommandHistory([
        {
          id: "cmd-001",
          command: "status",
          params: {},
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: "success",
          response: { status: "online", battery: 78 },
        },
        {
          id: "cmd-002",
          command: "configure",
          params: { interval: "30s" },
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          status: "success",
          response: { configured: true },
        },
        {
          id: "cmd-003",
          command: "reboot",
          params: {},
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          status: "success",
          response: { rebooted: true },
        },
      ])
      setLoading(false)
    }, 1000)
  }, [auth.isAuthenticated])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Command Interface */}
          <div className="lg:col-span-2">
            <CommandInterface />
          </div>

          {/* Command Templates */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Command Templates</h2>

              <div className="space-y-4">
                <div className="p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                  <h3 className="font-medium text-gray-800">Device Status</h3>
                  <p className="text-sm text-gray-600 mt-1">Get the current status of a device</p>
                  <pre className="mt-2 bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                    {'{\n  "command": "status",\n  "params": {}\n}'}
                  </pre>
                </div>

                <div className="p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                  <h3 className="font-medium text-gray-800">Configure Reporting Interval</h3>
                  <p className="text-sm text-gray-600 mt-1">Set how often the device reports data</p>
                  <pre className="mt-2 bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                    {'{\n  "command": "configure",\n  "params": {\n    "interval": "30s"\n  }\n}'}
                  </pre>
                </div>

                <div className="p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                  <h3 className="font-medium text-gray-800">Reboot Device</h3>
                  <p className="text-sm text-gray-600 mt-1">Restart the device remotely</p>
                  <pre className="mt-2 bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                    {'{\n  "command": "reboot",\n  "params": {}\n}'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Command History */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Command History</h2>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : commandHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Command
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Parameters
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Timestamp
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Response
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {commandHistory.map((cmd) => (
                      <tr key={cmd.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cmd.command}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Object.keys(cmd.params).length > 0 ? (
                            JSON.stringify(cmd.params)
                          ) : (
                            <span className="text-gray-400">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(cmd.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              cmd.status === "success"
                                ? "bg-green-100 text-green-800"
                                : cmd.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {cmd.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {JSON.stringify(cmd.response)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No command history available</div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
