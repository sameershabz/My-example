// pages/api/latestTimestream.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const AWS_LATEST_URL = process.env.AWS_LATEST_URL;
  if (!AWS_LATEST_URL) return res.status(500).json({ error: "Missing AWS_LATEST_URL" });

  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: "Missing refresh token" });

  // Exchange refresh token for a valid access token
  const accessToken = await getValidAccessToken(refreshToken);

  // Call your Lambda-backed endpoint
  const awsRes = await fetch(AWS_LATEST_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await awsRes.json();
  return res.status(awsRes.status).json(data);
}

async function getValidAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.COGNITO_CLIENT_ID!;
  const cognitoDomain = process.env.COGNITO_DOMAIN!; // 
  const resp = await fetch(`${cognitoDomain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  });
  const json = await resp.json();
  return json.access_token;
}