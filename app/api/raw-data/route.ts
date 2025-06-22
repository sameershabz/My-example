import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    console.log("Raw data API request URL:", request.url);
    const { searchParams } = new URL(request.url);
    console.log("Raw data API query parameters:", Object.fromEntries(searchParams.entries()));
    console.log("Raw data API cookies:", request.cookies.get("refreshToken")?.value);

    // ── ① require refreshToken ──
    const refreshToken = request.cookies.get("refreshToken")?.value
    if (!refreshToken) {
      console.error("Raw data API: Missing refresh token")
      return NextResponse.json({ 
        error: "Authentication required. Please log in again." 
      }, { status: 401 })
    }

    // ── ② exchange for access token ──
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
    const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_HOSTED_DOMAIN
    
    if (!clientId || !cognitoDomain) {
      console.error("Raw data API: Missing Cognito configuration")
      return NextResponse.json({ 
        error: "Server configuration error" 
      }, { status: 500 })
    }

    const tokenRes = await fetch(
      `${cognitoDomain}/oauth2/token`,
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
      const errorText = await tokenRes.text()
      console.error("Raw data API: Token refresh failed", { status: tokenRes.status, error: errorText })
      return NextResponse.json({ 
        error: "Authentication expired. Please log in again." 
      }, { status: 401 })
    }
    
    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      console.error("Raw data API: No access token in response")
      return NextResponse.json({ 
        error: "Authentication failed" 
      }, { status: 401 })
    }

    // ── ③ extract and validate query params ──
    const start = searchParams.get("start")
    const end = searchParams.get("end")
    const deviceId = searchParams.get("deviceId")

    if (!start || !end) {
      return NextResponse.json({ 
        error: "Start and end parameters are required" 
      }, { status: 400 })
    }

    // ── ④ get AWS raw data URL ──
    const awsRawDataUrl = process.env.AWS_RAW_DATA_URL
    if (!awsRawDataUrl) {
      console.error("Raw data API: AWS raw data URL not configured")
      return NextResponse.json({ 
        error: "Data service not configured" 
      }, { status: 500 })
    }

    // ── ⑤ build query string and forward request ──
    const queryParams = new URLSearchParams({ start, end })
    if (deviceId) {
      queryParams.append("deviceId", deviceId)
    }
    
    console.log(`Raw data API: Fetching from ${awsRawDataUrl} with params:`, queryParams.toString())
    
    const response = await fetch(`${awsRawDataUrl}?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Raw data API: AWS API error", { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      })
      return NextResponse.json({ 
        error: `Data service error: ${response.status} ${response.statusText}` 
      }, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json(result)

  } catch (error) {
    console.error("Raw data API error:", error)
    return NextResponse.json({ 
      error: "Internal server error. Please try again." 
    }, { status: 500 })
  }
}