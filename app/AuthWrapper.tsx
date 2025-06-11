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
  const [isInitialized, setIsInitialized] = useState(false)

  // 2) Handle auth state changes
  useEffect(() => {
    // Wait for auth to initialize
    if (auth.isLoading) return

    setIsInitialized(true)

    // Handle auth errors (like "no matching state")
    if (auth.error) {
      console.warn("Auth error:", auth.error)
      // Clear the error and redirect to signin
      auth.clearStaleState()
      router.replace("/signin")
      return
    }


  }, [auth.isLoading, auth.isAuthenticated, auth.error, router])

  // 1) If user is on /signin, don't protect the page
  if (pathname === "/signin") {
    return <>{children}</>
  }


  // Show loading while initializing
  if (!isInitialized || auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show nothing if there's an error or not authenticated
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
