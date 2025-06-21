"use client"
import { config } from "@/lib/config"
import { useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { useRouter } from "next/navigation"



export default function Logout() {
  const auth = useAuth()
  const router = useRouter()

  useEffect(() => {
    const performLogout = async () => {
      try {
        // Revoke token on server
        await fetch(config.api.revokeToken, { 
          method: "POST", 
          credentials: "include" 
        })
        console.log("Token revoked on server")
      } catch (error) {
        console.error("Token revocation failed:", error)
      }
      
      try {
        // Remove user locally
        await auth.removeUser()
        console.log("User removed locally")
        
        // Clear stale state
        auth.clearStaleState()
        
        // Clear any local storage or session storage
        if (typeof window !== 'undefined') {
          localStorage.clear()
          sessionStorage.clear()
        }
        
        // Force redirect to Cognito logout to clear session
        const logoutUrl = config.auth.cognitoDomain 
          ? `${config.auth.cognitoDomain}/logout?client_id=${config.auth.clientId}&logout_uri=${encodeURIComponent(config.auth.logoutUri)}`
          : "/signin"
        
        window.location.href = logoutUrl
      } catch (error) {
        console.error("Local logout failed:", error)
        // Force redirect to signin
        window.location.href = "/signin"
      }
    }

    performLogout()
  }, [auth, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Logging out...</p>
      </div>
    </div>
  )
}
