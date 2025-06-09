import type { User } from "oidc-client-ts"

export const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_dlB9DC7Ko",
  client_id: "79ufsa70isosab15kpcmlm628d",
  redirect_uri: typeof window !== "undefined" ? window.location.origin : "https://telematicshub.vercel.app",
  post_logout_redirect_uri:
    typeof window !== "undefined" ? `${window.location.origin}/signin` : "https://telematicshub.vercel.app/signin",
  response_type: "code",
  scope: "openid email profile",
  automaticSilentRenew: true,
  loadUserInfo: true,
  onSigninCallback: async (user: User | undefined) => {
    const refreshToken = user?.refresh_token
    if (refreshToken) {
      try {
        await fetch("/api/save-refresh-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
          credentials: "include",
        })
      } catch (error) {
        console.error("Failed to save refresh token:", error)
      }
    }
    // Clean up the URL after successful sign-in
    if (typeof window !== "undefined") {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  },
}
