"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, AlertCircle, CheckCircle } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { LoginDto } from "@/types/api"

interface SignInScreenProps {
  onSignIn: (email: string) => void
}

export function SignInScreen({ onSignIn }: SignInScreenProps) {
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  
  const { login, isLoading } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setError(null)

    try {
      const loginData: LoginDto = {
        email: email.trim(),
        ...(displayName.trim() && { displayName: displayName.trim() }),
      }

      await login(loginData)
      
      setShowSuccess(true)

      // Show success message briefly then sign in
      setTimeout(() => {
        onSignIn(email)
      }, 1500)

    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Failed to sign in. Please try again.')
    }
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-green-600 dark:text-green-400">
                  You are now signed in!
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-2">
                  Welcome to your collaborative workspace
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl sm:text-2xl font-bold">Welcome</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Sign in to access your collaborative notes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm sm:text-base">
                Email Address *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-11 sm:h-10 text-base sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-sm sm:text-base">
                Display Name (optional)
              </Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Enter your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
                className="h-11 sm:h-10 text-base sm:text-sm"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                If not provided, we'll auto-generate from your email (e.g., "user" from "user@example.com")
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-11 sm:h-10 text-base sm:text-sm"
              disabled={isLoading || !email.trim()}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Signing in...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Sign In
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              By signing in, you agree to collaborate respectfully with others
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
