// pages/api/command.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const AWS_COMMAND_URL = process.env.AWS_COMMAND_URL;
  if (!AWS_COMMAND_URL) {
    return res.status(500).json({ error: "Missing AWS_COMMAND_URL" });
  }

  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: "Missing refresh token" });

  const accessToken = await getValidAccessToken(refreshToken);

  const awsRes = await fetch(AWS_COMMAND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(req.body),
  });

  const text = await awsRes.text();
  res.status(awsRes.status).send(text);
}

async function getValidAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.COGNITO_CLIENT_ID!;
  const response = await fetch(
    "https://us-east-1dlb9dc7ko.auth.us-east-1.amazoncognito.com/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: refreshToken,
      }),
    }
  );

  const data = await response.json();
  return data.access_token;
}
