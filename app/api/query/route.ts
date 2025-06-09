import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const AWS_QUERY_URL = process.env.AWS_QUERY_URL
  if (!AWS_QUERY_URL) {
    return NextResponse.json({ error: "Missing AWS_QUERY_URL" }, { status: 500 })
  }

  const cookieStore = await cookies()
  const refreshToken = cookieStore.get("refreshToken")?.value
  if (!refreshToken) {
    return NextResponse.json({ error: "Missing refresh token" }, { status: 401 })
  }

  try {
    const accessToken = await getValidAccessToken(refreshToken)

    // Get query parameters from the request
    const { searchParams } = new URL(request.url)
    const queryString = searchParams.toString()

    const awsRes = await fetch(`${AWS_QUERY_URL}?${queryString}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!awsRes.ok) {
      throw new Error(`AWS API error: ${awsRes.status}`)
    }

    const text = await awsRes.text()

    // Try to parse as JSON
    try {
      const json = JSON.parse(text)
      return NextResponse.json(json)
    } catch {
      return new NextResponse(text, {
        status: awsRes.status,
        headers: { "Content-Type": "application/json" },
      })
    }
  } catch (error) {
    console.error("Query API error:", error)
    return NextResponse.json({ error: "Failed to query data" }, { status: 500 })
  }
}

async function getValidAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.COGNITO_CLIENT_ID!
  const cognitoDomain = process.env.COGNITO_DOMAIN!

  const response = await fetch(`https://${cognitoDomain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.status}`)
  }

  const data = await response.json()
  return data.access_token
}
