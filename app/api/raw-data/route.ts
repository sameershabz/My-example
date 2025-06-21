import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // ── ① require refreshToken ──
    const refreshToken = request.cookies.get("refreshToken")?.value
    if (!refreshToken) {
      return NextResponse.json({ error: "Missing refresh token" }, { status: 401 })
    }

    // ── ② exchange for access token ──
    const clientId = process.env.COGNITO_CLIENT_ID!
    const tokenRes = await fetch(
      `${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          refresh_token: refreshToken,
        }),
      }
    )
    
    if (!tokenRes.ok) {
      return NextResponse.json({ error: "Failed to refresh token" }, { status: 401 })
    }
    
    const { access_token: accessToken } = await tokenRes.json()

    // ── ③ extract and validate query params ──
    const { searchParams } = new URL(request.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")
    const deviceId = searchParams.get("deviceId")

    if (!start || !end) {
      return NextResponse.json({ error: "Start and end parameters are required" }, { status: 400 })
    }

    // ── ④ get AWS raw data URL ──
    const awsRawDataUrl = process.env.AWS_RAW_DATA_URL
    if (!awsRawDataUrl) {
      return NextResponse.json({ error: "AWS raw data URL not configured" }, { status: 500 })
    }

    // ── ⑤ build query string and forward request ──
    const queryParams = new URLSearchParams({ start, end })
    if (deviceId) {
      queryParams.append("deviceId", deviceId)
    }
    
    const response = await fetch(`${awsRawDataUrl}?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`AWS API responded with status: ${response.status}`)
    }

    const result = await response.json()
    return NextResponse.json(result)

  } catch (error) {
    console.error("Raw data API error:", error)
    return NextResponse.json({ error: "Failed to fetch raw data" }, { status: 500 })
  }
} 