"use client"

import type React from "react"
import { AuthProvider, useAuth } from "react-oidc-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cognitoAuthConfig } from "./authConfig"
import { Loader2, AlertCircle } from "lucide-react"

function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)

  // Public routes that don't require authentication
  const publicRoutes = ["/signin", "/logout-callback"]
  const isPublicRoute = publicRoutes.includes(pathname)

  useEffect(() => {
    // Short delay to prevent flash of loading state
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && !isPublicRoute) {
      router.replace("/signin")
    }
  }, [auth.isLoading, auth.isAuthenticated, router, isPublicRoute])

  // Show loading state while auth is initializing
  if (isLoading || (auth.isLoading && !isPublicRoute)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-700">Loading Telematics Hub...</p>
        </div>
      </div>
    )
  }

  // Show error state if auth failed and not on public route
  if (auth.error && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto" />
          <h1 className="mt-4 text-xl font-bold text-gray-900">Authentication Error</h1>
          <p className="mt-2 text-gray-600">{auth.error.message}</p>
          <button
            onClick={() => router.push("/signin")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    )
  }

  // If not authenticated and not on public route, don't render content
  if (!auth.isAuthenticated && !isPublicRoute) {
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
