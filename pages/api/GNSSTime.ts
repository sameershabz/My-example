import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const AWS_GNSS_URL = process.env.AWS_GNSS_URL;
  if (!AWS_GNSS_URL) {
    return res.status(500).json({ error: "Missing AWS_GNSS_URL" });
  }

  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: "Missing refresh token" });

  const accessToken = await getValidAccessToken(refreshToken);

  const awsRes = await fetch(AWS_GNSS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = await awsRes.text();
  res.status(awsRes.status).send(body);
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
