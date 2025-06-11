"use client"
import { useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { useRouter } from "next/navigation"
import { config } from "@/lib/config"

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

  return <div>Logging out…</div>
}
