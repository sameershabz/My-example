"use client"

import type React from "react"

import { AuthProvider, useAuth } from "react-oidc-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cognitoAuthConfig } from "./authConfig"

function AuthGate({ children }: { children: React.ReactNode }) {

  // if (process.env.NODE_ENV === "development") {
  //   return <>{children}</>
  // }

  const auth = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [isInitialized, setIsInitialized] = useState(false)
  const { isLoading, isAuthenticated, error, clearStaleState } = auth

  // 2) Handle auth state changes
  useEffect(() => {
    // Wait for auth to initialize
    if (isLoading) return

    setIsInitialized(true)

    // Handle auth errors (like "no matching state")
    if (error) {
      console.warn("Auth error:", error)
      // Clear the error and redirect to signin
      clearStaleState()
      router.replace("/signin")
      return
    }

    // If not authenticated, redirect to signin
    if (!isAuthenticated) {
      router.replace("/signin")
    }
  }, [isLoading, isAuthenticated, error, clearStaleState, router])

  // 1) If user is on /signin, don't protect the page
  if (pathname === "/signin" || pathname === "/auth/callback" || pathname === "/logout-callback") {
    return <>{children}</>
  }
  // Show loading while initializing
  if (!isInitialized || isLoading) {
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
  if (error || !isAuthenticated) {
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
