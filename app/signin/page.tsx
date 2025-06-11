"use client"

import { useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, LogIn } from "lucide-react"

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-card">
        <CardHeader className="space-y-2 text-center pb-6">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            Telematics Hub
          </CardTitle>
          <CardDescription className="text-base">Sign in to access your dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-6">
          {auth.isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Connecting...</p>
              </div>
            </div>
          ) : auth.error ? (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50">
              <p className="text-red-600 dark:text-red-400 text-center font-medium">{auth.error.message}</p>
            </div>
          ) : (
            <Button
              onClick={handleSignIn}
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold text-base"
              size="lg"
            >
              <LogIn className="mr-2 h-5 w-5" />
              Sign In
            </Button>
          )}
        </CardContent>
        <CardFooter className="border-t border-border pt-6 px-6">
          <p className="text-xs text-center text-muted-foreground w-full leading-relaxed">
            Secure access to your telematics dashboard and fleet management tools.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
