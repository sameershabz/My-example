import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST() {
  const refreshToken = cookies().get("refreshToken")?.value
  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 400 })
  }

  const clientId = process.env.COGNITO_CLIENT_ID || "79ufsa70isosab15kpcmlm628d"
  const domain = process.env.COGNITO_DOMAIN || "us-east-1dlb9dc7ko.auth.us-east-1.amazoncognito.com"

  try {
    // Call Cognito revoke endpoint
    await fetch(`https://${domain}/oauth2/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: refreshToken,
        client_id: clientId,
      }),
    })

    // Clear the cookie
    cookies().delete("refreshToken")

    return NextResponse.json({ message: "Token revoked" })
  } catch (error) {
    console.error("Error revoking token:", error)
    return NextResponse.json({ error: "Failed to revoke token" }, { status: 500 })
  }
}
