"use client"

import { useAuth } from "react-oidc-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"

export default function AuthCallback() {
  const auth = useAuth()
  const router = useRouter()

  useEffect(() => {
    const handleAuth = async () => {
      // The signinRedirectCallback is handled by the AuthProvider,
      // so we just need to wait for the user to be authenticated.
      if (auth.isAuthenticated) {
        if (auth.user?.refresh_token) {
          try {
            const res = await fetch("/api/save-refresh-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken: auth.user.refresh_token }),
            })
            if (!res.ok) {
              console.error("Failed to save refresh token.", await res.text())
            }
          } catch (err) {
            console.error("Error saving refresh token:", err)
          } finally {
            router.replace("/") // Redirect to home page
          }
        } else {
          console.warn("No refresh token found in user profile after authentication.")
          router.replace("/")
        }
      } else if (auth.error) {
        console.error("Authentication error during callback:", auth.error)
        // Optionally redirect to an error page or show a message
        router.replace("/signin?error=" + encodeURIComponent(auth.error.message))
      }
      // If still loading, the effect will re-run when auth state changes.
    }

    handleAuth()
  }, [auth, router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Finalizing authentication, please wait...</p>
    </div>
  )
}
