"use client"

import { useState, useEffect } from "react"
import { SignInScreen } from "@/components/sign-in-screen"
import { MainCanvas } from "@/components/main-canvas"

export default function Home() {
  const [user, setUser] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is already signed in
    const savedUser = localStorage.getItem("currentUser")
    if (savedUser) {
      setUser(savedUser)
    }
    setIsLoading(false)
  }, [])

  const handleSignIn = (email: string) => {
    setUser(email)
    localStorage.setItem("currentUser", email)
  }

  const handleSignOut = () => {
    setUser(null)
    localStorage.removeItem("currentUser")
    localStorage.removeItem("notes")
    localStorage.removeItem("users")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return <SignInScreen onSignIn={handleSignIn} />
  }

  return <MainCanvas currentUser={user} onSignOut={handleSignOut} />
}
