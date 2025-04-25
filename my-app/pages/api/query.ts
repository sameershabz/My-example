// pages/api/query.ts
import type { NextApiRequest, NextApiResponse } from "next";

const AWS_QUERY_URL = process.env.AWS_QUERY_URL!; 

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // forward the same query string
  const url = `${AWS_QUERY_URL}?${req.url?.split("?")[1]}`;
  // TODO: refresh tokens if needed (using your refresh cookie)
  const accessToken = await getValidAccessToken(req.cookies.refreshToken);

  const awsRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = await awsRes.text();
  res.status(awsRes.status).send(body);
}

async function getValidAccessToken(refreshToken?: string) {
  // call your auth provider’s token endpoint with the refresh token
  // return a fresh access_token string
  return "<new-access-token>";
}
