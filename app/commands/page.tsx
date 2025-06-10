"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "react-oidc-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Send, Plus, Trash } from "lucide-react"
import DashboardLayout from "../components/dashboard-layout"

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
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground">Send commands and parameters to your connected devices</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Send Command</CardTitle>
            <CardDescription>Configure and send commands to your fleet</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
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

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Parameters</Label>
                  {params.length < 10 && (
                    <Button type="button" variant="outline" size="sm" onClick={handleAddParam}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Parameter
                    </Button>
                  )}
                </div>

                {params.length > 0 ? (
                  <div className="space-y-3 border rounded-md p-4">
                    {params.map((param, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <Input
                          type="text"
                          value={param.key}
                          onChange={(e) => handleParamChange(index, "key", e.target.value)}
                          placeholder="Key"
                          className="flex-1"
                          required
                        />
                        <Input
                          type="text"
                          value={param.value}
                          onChange={(e) => handleParamChange(index, "value", e.target.value)}
                          placeholder="Value"
                          className="flex-1"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveParam(index)}
                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-6 border border-dashed rounded-md">
                    <p className="text-sm text-muted-foreground">No parameters added yet.</p>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddParam} className="mt-2">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Parameter
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-col space-y-4">
                <Button type="submit" disabled={loading || !command} className="w-full sm:w-auto">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Command
                    </>
                  )}
                </Button>

                {success && (
                  <div className="p-4 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50">
                    <p className="text-green-600 dark:text-green-400">{success}</p>
                  </div>
                )}

                {error && (
                  <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50">
                    <p className="text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Command History</CardTitle>
            <CardDescription>Recent commands sent to your devices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <div className="grid grid-cols-4 p-3 border-b bg-muted/50">
                <div className="font-medium">Command</div>
                <div className="font-medium">Parameters</div>
                <div className="font-medium">Status</div>
                <div className="font-medium">Timestamp</div>
              </div>
              <div className="divide-y">
                {/* Sample command history - this would be populated from actual data */}
                <div className="grid grid-cols-4 p-3">
                  <div>restart</div>
                  <div className="text-sm text-muted-foreground">device: "esp32-01"</div>
                  <div className="text-green-500">Success</div>
                  <div className="text-sm text-muted-foreground">{new Date().toLocaleString()}</div>
                </div>
                <div className="grid grid-cols-4 p-3">
                  <div>set_mode</div>
                  <div className="text-sm text-muted-foreground">mode: "eco", duration: "60"</div>
                  <div className="text-green-500">Success</div>
                  <div className="text-sm text-muted-foreground">{new Date(Date.now() - 3600000).toLocaleString()}</div>
                </div>
                <div className="grid grid-cols-4 p-3">
                  <div>update_config</div>
                  <div className="text-sm text-muted-foreground">interval: "30", power: "low"</div>
                  <div className="text-red-500">Failed</div>
                  <div className="text-sm text-muted-foreground">{new Date(Date.now() - 7200000).toLocaleString()}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
