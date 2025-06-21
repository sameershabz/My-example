import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  // ── ① require refreshToken cookie ──
  const refreshToken = request.cookies.get("refreshToken")?.value
  if (!refreshToken) {
    return NextResponse.json({ error: "Missing refresh token" }, { status: 401 })
  }

  // ── ② exchange for accessToken ──
  const clientId = process.env.COGNITO_CLIENT_ID!
  const tokenRes = await fetch(
    "https://us-east-1dlb9dc7ko.auth.us-east-1.amazoncognito.com/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        client_id:     clientId,
        refresh_token: refreshToken,
      }),
    }
  )
  if (!tokenRes.ok) {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 })
  }
  const { access_token: accessToken } = await tokenRes.json()

  // ── ③ read body ──
  const { command, params } = await request.json()
  if (!command) {
    return NextResponse.json({ error: "Command is required" }, { status: 400 })
  }

  // ── ④ forward to AWS or execute locally ──
  const awsUrl = process.env.AWS_COMMAND_URL
  if (awsUrl) {
    const awsRes = await fetch(awsUrl, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ command, params }),
    })
    const text = await awsRes.text()
    return new NextResponse(text, { status: awsRes.status })
  }

  // fallback local execution
  console.log("Executing locally:", command, params)
  return NextResponse.json({ message: `Command "${command}" executed.` })
}
