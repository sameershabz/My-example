"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "react-oidc-context"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"

interface ParamItem {
  key: string
  value: string
}

export default function CommandInterface() {
  const auth = useAuth()
  const [command, setCommand] = useState("")
  const [params, setParams] = useState<ParamItem[]>([])
  const [commandLoading, setCommandLoading] = useState(false)
  const [commandSuccess, setCommandSuccess] = useState("")
  const [error, setError] = useState("")

  const API_COMMAND_URL = "/api/command"

  const handleAddParam = () => {
    if (params.length < 10) {
      setParams([...params, { key: "", value: "" }])
    }
  }

  const handleParamChange = (index: number, field: "key" | "value", value: string) => {
    const newParams = [...params]
    newParams[index][field] = value
    setParams(newParams)
  }

  const handleRemoveParam = (index: number) => {
    const newParams = [...params]
    newParams.splice(index, 1)
    setParams(newParams)
  }

  const handleCommandSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCommandLoading(true)
    setCommandSuccess("")
    setError("")

    const paramsObj: Record<string, string> = {}
    params.forEach((p) => {
      if (p.key) paramsObj[p.key] = p.value
    })

    const payload = {
      command,
      params: paramsObj,
    }

    try {
      const response = await fetch(API_COMMAND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text()}`)
      }

      const text = await response.text()
      try {
        JSON.parse(text)
        setCommandSuccess("Command sent successfully")
      } catch {
        setCommandSuccess("Command sent (non-JSON response)")
      }

      setCommand("")
      setParams([])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send command")
    } finally {
      setCommandLoading(false)
    }
  }

  const commonCommands = [
    { name: "status", description: "Get device status" },
    { name: "reboot", description: "Reboot device" },
    { name: "update", description: "Update firmware" },
    { name: "configure", description: "Configure device settings" },
  ]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Command Interface</h2>

      {/* Quick commands */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Commands</h3>
        <div className="flex flex-wrap gap-2">
          {commonCommands.map((cmd) => (
            <button
              key={cmd.name}
              onClick={() => setCommand(cmd.name)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-800 transition-colors"
              title={cmd.description}
            >
              {cmd.name}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleCommandSubmit}>
        <div className="mb-4">
          <label htmlFor="command" className="block text-sm font-medium text-gray-700 mb-1">
            Command
          </label>
          <input
            id="command"
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Enter command (e.g., status)"
            className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700">Parameters</label>
            {params.length < 10 && (
              <button type="button" onClick={handleAddParam} className="text-sm text-blue-600 hover:text-blue-800">
                + Add Parameter
              </button>
            )}
          </div>

          {params.length > 0 ? (
            <div className="space-y-2">
              {params.map((param, index) => (
                <div key={index} className="flex space-x-2">
                  <input
                    type="text"
                    value={param.key}
                    onChange={(e) => handleParamChange(index, "key", e.target.value)}
                    placeholder="Key"
                    className="w-1/3 p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <input
                    type="text"
                    value={param.value}
                    onChange={(e) => handleParamChange(index, "value", e.target.value)}
                    placeholder="Value"
                    className="w-1/2 p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveParam(index)}
                    className="p-2 text-red-600 hover:text-red-800"
                    aria-label="Remove parameter"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No parameters added</p>
          )}
        </div>

        <div>
          <button
            type="submit"
            disabled={commandLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {commandLoading ? (
              <span className="flex items-center">
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Sending...
              </span>
            ) : (
              "Send Command"
            )}
          </button>
        </div>

        {commandSuccess && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded flex items-start">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 text-sm">{commandSuccess}</p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
      </form>
    </div>
  )
}
