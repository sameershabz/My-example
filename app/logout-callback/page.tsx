"use client"
import { useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { useRouter } from "next/navigation"


export default function LogoutCallback() {
  const auth = useAuth()
  const router = useRouter()

  useEffect(() => {
    console.log("Logout callback - Auth state:", {
      isAuthenticated: auth.isAuthenticated,
      isLoading: auth.isLoading,
      error: auth.error
    })

    // Manually clear the user session and redirect
    const handleLogout = async () => {
      try {
        // Force remove the user from local storage
        await auth.removeUser()
        console.log("User removed, redirecting to signin")
        
        // Clear any stale state
        auth.clearStaleState()
        
        // Clear all storage
        if (typeof window !== 'undefined') {
          localStorage.clear()
          sessionStorage.clear()
          
          // Clear all cookies
          document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
          });
        }
        
        // Redirect to signin
        window.location.href = "/signin"
      } catch (error) {
        console.error("Manual logout failed:", error)
        // Force redirect anyway
        window.location.href = "/signin"
      }
    }

    // Wait a moment for any automatic processing, then force logout
    const timer = setTimeout(handleLogout, 1000)
    return () => clearTimeout(timer)
  }, [auth, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Finalizing logout...</p>
      </div>
    </div>
  )
}
