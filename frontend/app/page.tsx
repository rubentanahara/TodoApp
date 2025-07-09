"use client"

import { SignInScreen } from "@/components/sign-in-screen"
import { MainCanvas } from "@/components/main-canvas"
import { useAuthCheck, useAuth } from "@/lib/auth"

export default function Home() {
  const { isAuthenticated, user, isLoading } = useAuthCheck()
  const { logout } = useAuth()

  const handleSignIn = (email: string) => {
    // This is handled by the auth provider now
    // The component will re-render when authentication state changes
  }

  const handleSignOut = async () => {
    // Logout and let the auth provider handle state updates
    await logout()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <SignInScreen onSignIn={handleSignIn} />
  }

  return <MainCanvas currentUser={user.email} onSignOut={handleSignOut} />
}
