import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refreshToken } = body

    if (!refreshToken) {
      return NextResponse.json({ error: "Refresh token is required" }, { status: 400 })
    }

    // Store the refresh token in a secure HTTP-only cookie
    const cookieStore = cookies()
    cookieStore.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Save refresh token error:", error)
    return NextResponse.json({ error: "Failed to save refresh token" }, { status: 500 })
  }
}
