"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail } from "lucide-react"

interface SignInScreenProps {
  onSignIn: (email: string) => void
}

export function SignInScreen({ onSignIn }: SignInScreenProps) {
  const [email, setEmail] = useState("")
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsSigningIn(true)

    // Simulate sign-in process
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setShowSuccess(true)

    // Show success message briefly then sign in
    setTimeout(() => {
      onSignIn(email)
    }, 1500)
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
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
          <CardDescription className="text-sm sm:text-base">Sign in to access your collaborative notes</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm sm:text-base">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSigningIn}
                className="h-11 sm:h-10 text-base sm:text-sm"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 sm:h-10 text-base sm:text-sm"
              disabled={isSigningIn || !email.trim()}
            >
              {isSigningIn ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
