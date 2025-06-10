import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { command, params } = body

    if (!command) {
      return NextResponse.json({ error: "Command is required" }, { status: 400 })
    }

    // Get AWS command URL from environment
    const awsCommandUrl = process.env.AWS_COMMAND_URL
    if (!awsCommandUrl) {
      return NextResponse.json({ error: "AWS command URL not configured" }, { status: 500 })
    }

    // Forward the command to AWS
    const response = await fetch(awsCommandUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command, params }),
    })

    if (!response.ok) {
      throw new Error(`AWS API responded with status: ${response.status}`)
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Command API error:", error)
    return NextResponse.json({ error: "Failed to send command" }, { status: 500 })
  }
}
