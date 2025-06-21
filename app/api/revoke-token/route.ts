import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    // Remove the refresh token cookie
    const cookieStore = cookies()
    cookieStore.delete("refresh_token")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Revoke token error:", error)
    return NextResponse.json({ error: "Failed to revoke token" }, { status: 500 })
  }
}
