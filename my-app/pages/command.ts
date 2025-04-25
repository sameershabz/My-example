// pages/api/command.ts
import type { NextApiRequest, NextApiResponse } from "next";

const AWS_COMMAND_URL = process.env.AWS_COMMAND_URL!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // get or refresh your access token
  const accessToken = await getValidAccessToken(req.cookies.refreshToken);

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

async function getValidAccessToken(refreshToken?: string) {
  return "<new-access-token>";
}
