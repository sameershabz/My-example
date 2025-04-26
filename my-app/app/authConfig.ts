// app/authConfig.ts
import type { User } from "oidc-client-ts"; // <-- this package


export const cognitoAuthConfig = {
  authority: "https://…",
  client_id: "…",
  redirect_uri: "…",
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
