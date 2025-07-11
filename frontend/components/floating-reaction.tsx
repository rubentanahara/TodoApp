"use client"

import React, { useEffect, useState } from "react"

interface FloatingReactionProps {
  reaction: string
  x: number
  y: number
  userEmail: string
  onComplete: () => void
}

export function FloatingReaction({ reaction, x, y, userEmail, onComplete }: FloatingReactionProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Start the animation immediately
    const timer = setTimeout(() => {
      setIsVisible(false)
      // Call onComplete after animation finishes
      setTimeout(onComplete, 100)
    }, 2000) // Total animation duration

    return () => clearTimeout(timer)
  }, [onComplete])

  if (!isVisible) return null

  const displayName = userEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  return (
    <div
      className="fixed pointer-events-none z-[100]"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Floating Reaction */}
      <div className="animate-float-bounce flex flex-col items-center">
        {/* Reaction Emoji */}
        <div className="text-4xl animate-reaction-bounce">
          {reaction}
        </div>
        
        {/* User Name */}
        <div className="mt-2 bg-black/80 text-white px-2 py-1 rounded-full text-xs font-medium animate-fade-in-up">
          {displayName}
        </div>
      </div>
    </div>
  )
} 