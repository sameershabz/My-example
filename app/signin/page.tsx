"use client"

import { useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function SignIn() {
  const auth = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (auth.isAuthenticated) {
      router.replace("/")
    }
  }, [auth.isAuthenticated, router])

  if (auth.isAuthenticated) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Telematics Hub</h1>
          <p className="text-gray-600 mt-2">Sign in to access your dashboard</p>
        </div>

        {auth.isLoading ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-4 text-gray-700">Authenticating...</p>
          </div>
        ) : auth.error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-bold">Authentication Error</p>
            <p>{auth.error.message}</p>
          </div>
        ) : (
          <button
            onClick={() => auth.signinRedirect()}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition duration-200 flex items-center justify-center"
          >
            Sign in with Cognito
          </button>
        )}

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Secure access to vehicle telematics data</p>
        </div>
      </div>
    </div>
  )
}
