"use client"

import type React from "react"
import { useState } from "react"
import { useAuth } from "react-oidc-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Send, Plus, Trash2 } from "lucide-react"

type ParamItem = {
  key: string
  value: string
}

export default function Commands() {
  const auth = useAuth()
  const [command, setCommand] = useState("")
  const [params, setParams] = useState<ParamItem[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  // Show loading state while auth is initializing
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-700">Loading commands...</p>
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
          <p className="text-gray-700">Please sign in to access commands.</p>
        </div>
      </div>
    )
  }

  // Rest of component logic...
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccess("")
    setError("")

    try {
      const paramsObj: Record<string, string> = {}
      params.forEach((p) => {
        if (p.key) paramsObj[p.key] = p.value
      })

      const payload = {
        command,
        params: paramsObj,
      }

      const response = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        setSuccess("Command sent successfully")
        setCommand("")
        setParams([])
      } else {
        throw new Error(`Failed to send command: ${response.status}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send command")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Command Center</h1>

      <Card>
        <CardHeader>
          <CardTitle>Send Command to Devices</CardTitle>
          <CardDescription>Send commands and parameters to your connected devices</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="command">Command</Label>
              <Input
                id="command"
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Enter command (e.g., turn_on, restart)"
                required
              />
            </div>

            <div>
              <Label>Parameters</Label>
              {params.map((param, index) => (
                <div key={index} className="flex space-x-2 mb-2">
                  <Input
                    type="text"
                    value={param.key}
                    onChange={(e) => handleParamChange(index, "key", e.target.value)}
                    placeholder="Key"
                    className="flex-1"
                  />
                  <Input
                    type="text"
                    value={param.value}
                    onChange={(e) => handleParamChange(index, "value", e.target.value)}
                    placeholder="Value"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => handleRemoveParam(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {params.length < 10 && (
                <Button type="button" variant="outline" onClick={handleAddParam} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Parameter
                </Button>
              )}
            </div>

            <Button type="submit" disabled={loading || !command}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {loading ? "Sending..." : "Send Command"}
            </Button>

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-600">{success}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600">{error}</p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
