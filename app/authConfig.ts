// app/authConfig.ts
import type { User } from "oidc-client-ts"; // <-- this package


export const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_dlB9DC7Ko",
  client_id: "79ufsa70isosab15kpcmlm628d",
  redirect_uri: "https://v0-my-site-tau.vercel.app/",
  response_type: "code",
  scope: "openid email",
  onSigninCallback: async (user: User | undefined) => {
    const refreshToken = user?.refresh_token;
    if (refreshToken) {
      await fetch("/api/save-refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        credentials: "include",
      });
    }
  },
};
