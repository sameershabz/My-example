// pages/api/revoke-token.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(400).json({ error: "No refresh token" });

  const clientId = process.env.COGNITO_CLIENT_ID!;
  const domain   = process.env.COGNITO_DOMAIN!;    // e.g. "yourpool.auth.us-east-1.amazoncognito.com"

  // Call Cognito revoke endpoint
  await fetch(`https://${domain}/oauth2/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token: refreshToken,
      client_id: clientId,
    }),
  });

  // Clear the cookie
  res.setHeader(
    "Set-Cookie",
    serialize("refreshToken", "", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
    })
  );

  return res.status(200).json({ message: "Token revoked" });
}
