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
      "https://us-east-1dlb9dc7ko.auth.us-east-1.amazoncognito.com/oauth2/token",
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
    const { access_token: accessToken } = await tokenRes.json()

    // ── ③ extract and validate query params ──
    const { searchParams } = new URL(request.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")
    const points = searchParams.get("points") || "24"

    if (!start || !end) {
      return NextResponse.json({ error: "Start and end parameters are required" }, { status: 400 })
    }

    // ── ④ get AWS query URL ──
    const awsQueryUrl = process.env.AWS_QUERY_URL
    if (!awsQueryUrl) {
      return NextResponse.json({ error: "AWS query URL not configured" }, { status: 500 })
    }

    // ── ⑤ build query string and forward request ──
    const queryParams = new URLSearchParams({ start, end, points })
    const response = await fetch(`${awsQueryUrl}?${queryParams}`, {
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
    console.error("Query API error:", error)
    return NextResponse.json({ error: "Failed to query data" }, { status: 500 })
  }
}
