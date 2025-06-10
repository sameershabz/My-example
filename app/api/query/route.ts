import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")
    const points = searchParams.get("points") || "24"

    if (!start || !end) {
      return NextResponse.json({ error: "Start and end parameters are required" }, { status: 400 })
    }

    // Get AWS query URL from environment
    const awsQueryUrl = process.env.AWS_QUERY_URL
    if (!awsQueryUrl) {
      return NextResponse.json({ error: "AWS query URL not configured" }, { status: 500 })
    }

    // Build query parameters
    const queryParams = new URLSearchParams({
      start,
      end,
      points,
    })

    // Forward the query to AWS
    const response = await fetch(`${awsQueryUrl}?${queryParams}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`AWS API responded with status: ${response.status}`)
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Query API error:", error)
    return NextResponse.json({ error: "Failed to query data" }, { status: 500 })
  }
}
