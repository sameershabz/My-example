import type { NextApiRequest, NextApiResponse } from "next"

type ResponseData = {
  message?: string
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` })
  }

  try {
    // ── ① require refreshToken cookie ──
    const refreshToken = req.cookies.refreshToken
    if (!refreshToken) {
      return res.status(401).json({ error: "Missing refresh token" })
    }

    // ── ② exchange for access token via Cognito ──
    const clientId = process.env.COGNITO_CLIENT_ID
    if (!clientId) {
      console.error("Missing COGNITO_CLIENT_ID")
      return res.status(500).json({ error: "Server configuration error" })
    }
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
      console.error("Failed to refresh token:", await tokenRes.text())
      return res.status(401).json({ error: "Invalid refresh token" })
    }
    const tokenJson = await tokenRes.json()
    const accessToken = tokenJson.access_token
    if (!accessToken) {
      console.error("No access_token in response:", tokenJson)
      return res.status(401).json({ error: "Invalid token response" })
    }

    // ── ③ validate request body ──
    const { command, params } = req.body as { command?: string; params?: Record<string, any> }
    if (!command || typeof command !== "string") {
      return res.status(400).json({ error: "Command is required" })
    }
    // Optional: validate params shape if needed

    // ── ④ forward or locally execute ──
    const awsCommandUrl = process.env.AWS_COMMAND_URL
    if (awsCommandUrl) {
      // Forward to AWS endpoint
      const forwardRes = await fetch(awsCommandUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ command, params }),
      })
      if (!forwardRes.ok) {
        const text = await forwardRes.text().catch(() => "")
        console.error("AWS command endpoint error:", forwardRes.status, text)
        return res
          .status(forwardRes.status)
          .json({ error: `Command API responded with ${forwardRes.status}` })
      }
      const forwardJson = await forwardRes.json().catch(() => null)
      // You can customize the response shape:
      return res.status(200).json({
        message: forwardJson?.message || "Command forwarded successfully",
      })
    } else {
      // Local execution logic
      console.log(`Executing command locally: ${command}`, params ?? {})
      // TODO: replace with actual logic
      const result = `Command "${command}" executed successfully.`
      return res.status(200).json({ message: result })
    }
  } catch (err) {
    console.error("Command API error:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}
