import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Get AWS GNSS URL from environment
    const awsGnssUrl = process.env.AWS_GNSS_URL
    if (!awsGnssUrl) {
      return NextResponse.json({ error: "AWS GNSS URL not configured" }, { status: 500 })
    }

    // Forward the request to AWS
    const response = await fetch(awsGnssUrl, {
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
    console.error("GNSS Time API error:", error)
    return NextResponse.json({ error: "Failed to fetch GNSS time data" }, { status: 500 })
  }
}
