"use client"

import { useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export default function SignIn() {
  const auth = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (auth.isAuthenticated) {
      router.push("/")
    }
  }, [auth.isAuthenticated, router])

  const handleSignIn = () => {
    auth.signinRedirect()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Telematics Hub</CardTitle>
          <CardDescription className="text-center">Sign in to access your dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {auth.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : auth.error ? (
            <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50">
              <p className="text-red-600 dark:text-red-400 text-center">{auth.error.message}</p>
            </div>
          ) : (
            <Button onClick={handleSignIn} className="w-full" size="lg">
              Sign In
            </Button>
          )}
        </CardContent>
        <CardFooter className="border-t pt-4">
          <p className="text-xs text-center text-muted-foreground w-full">
            Secure access to your telematics dashboard and fleet management tools.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
