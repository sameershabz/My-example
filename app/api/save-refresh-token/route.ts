import { NextRequest, NextResponse } from "next/server"
import { serialize } from "cookie"

export async function POST(request: NextRequest) {
  const { refresh_token } = await request.json()
  if (!refresh_token) {
    return NextResponse.json({ error: "Missing refresh token" }, { status: 400 })
  }

  const cookie = serialize("refreshToken", refresh_token, {
    path: "/", httpOnly: true, secure: true, sameSite: "lax", maxAge: 60*60*24*30
  })
  return NextResponse.json(
    { message: "Refresh token stored" },
    { status: 200, headers: { "Set-Cookie": cookie } }
  )
}
