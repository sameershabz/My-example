import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  const AWS_COMMAND_URL = process.env.AWS_COMMAND_URL
  if (!AWS_COMMAND_URL) {
    return NextResponse.json({ error: "Missing AWS_COMMAND_URL" }, { status: 500 })
  }

  const cookieStore = await cookies()
  const refreshToken = cookieStore.get("refreshToken")?.value
  if (!refreshToken) {
    return NextResponse.json({ error: "Missing refresh token" }, { status: 401 })
  }

  try {
    const accessToken = await getValidAccessToken(refreshToken)
    const body = await request.json()

    const awsRes = await fetch(AWS_COMMAND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })

    const text = await awsRes.text()

    // Try to parse as JSON, if it fails return as text
    try {
      const json = JSON.parse(text)
      return NextResponse.json(json, { status: awsRes.status })
    } catch {
      return new NextResponse(text, { status: awsRes.status })
    }
  } catch (error) {
    console.error("Command API error:", error)
    return NextResponse.json({ error: "Failed to send command" }, { status: 500 })
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
