"use client"
import { useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function LogoutCallback() {
  const auth = useAuth()
  const router = useRouter()

  useEffect(() => {
    const handleLogout = async () => {
      try {
        // 1) Revoke on the server (clears cookie too)
        await fetch("/api/revoke-token", {
          method: "POST",
          credentials: "include",
        })
      } catch (error) {
        console.error("Error revoking token:", error)
      } finally {
        // 2) Remove local user and redirect
        auth.removeUser()
        setTimeout(() => {
          router.replace("/signin")
        }, 1000)
      }
    }

    handleLogout()
  }, [auth, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        <p className="mt-4 text-gray-700">Signing out...</p>
      </div>
    </div>
  )
}
