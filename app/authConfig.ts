// app/authConfig.ts
import type { User } from "oidc-client-ts"
import { config } from "@/lib/config"

export const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_dlB9DC7Ko",
  client_id: config.auth.clientId,
  redirect_uri: config.auth.redirectUri,
  response_type: "code",
  scope: "openid email",
  onSigninCallback: async (user: User | undefined) => {
    const refreshToken = user?.refresh_token
    if (refreshToken) {
      await fetch(config.api.saveRefreshToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        credentials: "include",
      })
    }
  },
}
