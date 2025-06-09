import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { refresh_token } = body

    if (!refresh_token) {
      return NextResponse.json({ error: "Missing refresh token" }, { status: 400 })
    }

    cookies().set({
      name: "refreshToken",
      value: refresh_token,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return NextResponse.json({ message: "Refresh token stored" })
  } catch (error) {
    console.error("Error saving refresh token:", error)
    return NextResponse.json({ error: "Failed to save refresh token" }, { status: 500 })
  }
}
