// app/authConfig.ts
import type { User } from "oidc-client-ts"
import { config } from "@/lib/config"


const baseUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

const logoutUri = `${baseUrl}/logout-callback`


export const cognitoAuthConfig = {
  authority: config.auth.cognitoDomain,
  client_id: config.auth.clientId,
  redirect_uri: config.auth.redirectUri,
  post_logout_redirect_uri: logoutUri,
  response_type: "code",
  scope: "openid email profile",
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
