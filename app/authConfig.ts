// app/authConfig.ts
import type { User } from "oidc-client-ts"
import { config } from "@/lib/config"

export const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_dlB9DC7Ko",
  client_id: "79ufsa70isosab15kpcmlm628d",
  redirect_uri: process.env.NEXT_PUBLIC_BASE_URL,
  post_logout_redirect_uri: config.auth.logoutUri,
  response_type: "code",
  scope: "email openid phone",
  onSigninCallback: async (user: User | undefined) => {
    const refreshToken = user?.refresh_token
    if (refreshToken) {
      try {
        await fetch(config.api.saveRefreshToken, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
          credentials: "include",
        })
      } catch (error) {
        console.error("Failed to save refresh token:", error)
      }
    }
  },
}
