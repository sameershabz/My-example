"use client"

import { useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { useRouter } from "next/navigation"
import { config } from "@/lib/config"
import { Loader2 } from "lucide-react"

export default function LogoutCallback() {
  const auth = useAuth()
  const router = useRouter()

  useEffect(() => {
    // 1) Revoke on the server (clears cookie too)
    fetch(config.api.revokeToken, {
      method: "POST",
      credentials: "include",
    }).finally(() => {
      // 2) Remove local user and redirect
      auth.removeUser()
      router.replace("/signin")
    })
  }, [auth, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="mt-4 text-muted-foreground">Logging out...</p>
      </div>
    </div>
  )
}
