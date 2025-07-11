"use client"

import React, { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Smile, Plus } from "lucide-react"
import { NoteReactionSummaryDto } from "@/types/api"

interface ReactionPickerProps {
  noteId: string
  reactions: NoteReactionSummaryDto[]
  onAddReaction: (noteId: string, reactionType: string) => void
  onRemoveReaction: (noteId: string, reactionType: string) => void
  disabled?: boolean
}

const AVAILABLE_REACTIONS = [
  { emoji: "👍", name: "thumbs_up" },
  { emoji: "❤️", name: "heart" },
  { emoji: "😂", name: "laughing" },
  { emoji: "😮", name: "surprised" },
  { emoji: "😢", name: "sad" },
  { emoji: "😡", name: "angry" },
]

export function ReactionPicker({
  noteId,
  reactions,
  onAddReaction,
  onRemoveReaction,
  disabled = false
}: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [animatingReactions, setAnimatingReactions] = useState<Set<string>>(new Set())
  const [floatingReaction, setFloatingReaction] = useState<string | null>(null)

  // Animation effect for floating reactions
  useEffect(() => {
    if (floatingReaction) {
      const timer = setTimeout(() => {
        setFloatingReaction(null)
      }, 1000) // Animation duration
      return () => clearTimeout(timer)
    }
  }, [floatingReaction])

  const handleReactionClick = useCallback((reactionType: string, hasCurrentUser: boolean) => {
    // Add animation to the reaction
    setAnimatingReactions(prev => new Set([...prev, reactionType]))
    
    if (hasCurrentUser) {
      onRemoveReaction(noteId, reactionType)
    } else {
      onAddReaction(noteId, reactionType)
      // Trigger floating animation for new reactions
      setFloatingReaction(reactionType)
    }
    setIsOpen(false)
    
    // Remove animation state after animation completes
    setTimeout(() => {
      setAnimatingReactions(prev => {
        const newSet = new Set(prev)
        newSet.delete(reactionType)
        return newSet
      })
    }, 300)
  }, [noteId, onAddReaction, onRemoveReaction])

  const handlePickerReactionClick = useCallback((reactionType: string) => {
    // Add animation to the reaction
    setAnimatingReactions(prev => new Set([...prev, reactionType]))
    
    const existingReaction = reactions.find(r => r.hasCurrentUser)
    if (existingReaction && existingReaction.reactionType === reactionType) {
      onRemoveReaction(noteId, reactionType)
    } else {
      onAddReaction(noteId, reactionType)
      // Trigger floating animation for new reactions
      setFloatingReaction(reactionType)
    }
    setIsOpen(false)
    
    // Remove animation state after animation completes
    setTimeout(() => {
      setAnimatingReactions(prev => {
        const newSet = new Set(prev)
        newSet.delete(reactionType)
        return newSet
      })
    }, 300)
  }, [noteId, reactions, onAddReaction, onRemoveReaction])

  const handleStopPropagation = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }, [])

  // Show existing reactions if any
  const displayReactions = reactions.filter(r => r.count > 0)

  return (
    <div 
      className="flex items-center gap-1 mt-1 flex-wrap"
      data-reaction-picker
      onClick={handleStopPropagation}
      onMouseDown={handleStopPropagation}
      onTouchStart={handleStopPropagation}
    >
      {/* Floating reaction animation */}
      {floatingReaction && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 pointer-events-none z-50">
          <div className="animate-float-up text-lg opacity-0">
            {floatingReaction}
          </div>
        </div>
      )}
      
      {/* Existing reactions */}
      {displayReactions.map((reaction) => (
        <button
          key={reaction.reactionType}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs transition shrink-0
            ${reaction.hasCurrentUser
              ? "border-primary bg-primary/10 text-primary font-semibold"
              : "border-border bg-transparent text-muted-foreground hover:border-accent"}
          `}
          title={`Reacted with ${reaction.reactionType}`}
          aria-label={`Reacted with ${reaction.reactionType}`}
          onClick={() => handleReactionClick(reaction.reactionType, reaction.hasCurrentUser)}
          onMouseDown={handleStopPropagation}
          onTouchStart={handleStopPropagation}
          disabled={disabled}
        >
          <span className="text-sm">{reaction.reactionType}</span>
          <span className="font-bold text-xs">{reaction.count}</span>
        </button>
      ))}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            className="w-6 h-6 flex items-center justify-center rounded-full border border-accent text-accent bg-transparent hover:bg-accent/10 transition ml-1 shrink-0"
            title="Add reaction"
            aria-label="Add reaction"
            onMouseDown={handleStopPropagation}
            onTouchStart={handleStopPropagation}
            disabled={disabled}
          >
            <Smile className="w-3 h-3" />
            {/* <Plus className="w-3 h-3 -ml-1" /> */}
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-2 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2" 
          align="start"
          onClick={handleStopPropagation}
          onMouseDown={handleStopPropagation}
          onTouchStart={handleStopPropagation}
        >
          <Card className="p-2 border-0 shadow-lg">
            <div className="flex gap-1">
              {AVAILABLE_REACTIONS.map((reaction, index) => {
                const existingReaction = reactions.find(r => r.reactionType === reaction.emoji)
                const hasCurrentUser = existingReaction?.hasCurrentUser || false
                return (
                  <Button
                    key={reaction.emoji}
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePickerReactionClick(reaction.emoji)}
                    onMouseDown={handleStopPropagation}
                    onTouchStart={handleStopPropagation}
                    className={`h-8 w-8 flex items-center justify-center rounded-full border text-lg transition-all duration-200
                      ${hasCurrentUser ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border bg-transparent text-muted-foreground hover:border-accent"}
                    `}
                    style={{ animationDelay: `${index * 50}ms` }}
                    title={reaction.name}
                    aria-label={reaction.name}
                  >
                    <span className="transition-transform duration-200 hover:animate-wiggle">
                      {reaction.emoji}
                    </span>
                  </Button>
                )
              })}
            </div>
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  )
} 