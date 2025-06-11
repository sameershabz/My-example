"use client"

import type React from "react"

import { AuthProvider, useAuth } from "react-oidc-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cognitoAuthConfig } from "./authConfig"

function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false)

  useEffect(() => {
    // 1) If user is on /signin, don't protect the page
    if (pathname === "/signin") {
      return
    }

    // 2) Handle auth state and errors
    if (auth.isLoading) return

    // Handle auth errors like "no matching state"
    if (auth.error) {
      console.warn("Auth error detected:", auth.error.message)
      // Clear any stale auth state
      try {
        auth.removeUser()
        auth.clearStaleState()
      } catch (e) {
        console.warn("Error clearing auth state:", e)
      }
      // Redirect to signin
      router.replace("/signin")
      return
    }

    // If not authenticated, redirect to signin
    if (!auth.isAuthenticated) {
      if (hasCheckedAuth) {
        router.replace("/signin")
      }
    }

    setHasCheckedAuth(true)
  }, [auth.isLoading, auth.isAuthenticated, auth.error, router, hasCheckedAuth])

  // Show loading while checking auth
  if (auth.isLoading || !hasCheckedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render if there's an error or not authenticated
  if (auth.error || !auth.isAuthenticated) {
    return null
  }

  return <>{children}</>
}

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider {...cognitoAuthConfig}>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  )
}
