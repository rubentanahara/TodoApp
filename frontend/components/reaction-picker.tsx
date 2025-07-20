"use client"

import React, { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, Heart } from "lucide-react"
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
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [floatingReaction])

  const handleReactionClick = useCallback((reactionType: string, hasCurrentUser: boolean) => {
    setAnimatingReactions(prev => new Set([...prev, reactionType]))
    
    if (hasCurrentUser) {
      onRemoveReaction(noteId, reactionType)
    } else {
      onAddReaction(noteId, reactionType)
      setFloatingReaction(reactionType)
    }
    
    setTimeout(() => {
      setAnimatingReactions(prev => {
        const newSet = new Set(prev)
        newSet.delete(reactionType)
        return newSet
      })
    }, 200)
  }, [noteId, onAddReaction, onRemoveReaction])

  const handlePickerReactionClick = useCallback((reactionType: string) => {
    setAnimatingReactions(prev => new Set([...prev, reactionType]))
    
    const existingReaction = reactions.find(r => r.hasCurrentUser)
    if (existingReaction && existingReaction.reactionType === reactionType) {
      onRemoveReaction(noteId, reactionType)
    } else {
      onAddReaction(noteId, reactionType)
      setFloatingReaction(reactionType)
    }
    setIsOpen(false)
    
    setTimeout(() => {
      setAnimatingReactions(prev => {
        const newSet = new Set(prev)
        newSet.delete(reactionType)
        return newSet
      })
    }, 200)
  }, [noteId, reactions, onAddReaction, onRemoveReaction])

  const handleStopPropagation = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }, [])

  const displayReactions = reactions.filter(r => r.count > 0)
  const hasReactions = displayReactions.length > 0

  return (
    <div 
      className="relative"
      data-reaction-picker
      onClick={handleStopPropagation}
      onMouseDown={handleStopPropagation}
      onTouchStart={handleStopPropagation}
    >
      {/* Floating reaction animation */}
      {floatingReaction && (
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 pointer-events-none z-50">
          <div className="animate-float-up text-lg">
            {floatingReaction}
          </div>
        </div>
      )}
      
      {/* Reactions Container */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Existing reactions with modern pill design */}
        {displayReactions.map((reaction) => (
          <button
            key={reaction.reactionType}
            className={`
              group flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 
              ${reaction.hasCurrentUser
                ? "bg-primary/15 border border-primary/30 text-primary shadow-sm hover:bg-primary/20 hover:scale-105" 
                : "bg-muted/50 border border-muted-foreground/20 text-muted-foreground hover:bg-muted hover:border-muted-foreground/30 hover:text-foreground"
              }
            `}
            onClick={() => handleReactionClick(reaction.reactionType, reaction.hasCurrentUser)}
            onMouseDown={handleStopPropagation}
            onTouchStart={handleStopPropagation}
            disabled={disabled}
          >
            <span className="text-base transition-transform group-hover:scale-110">
              {reaction.reactionType}
            </span>
            <span className={`text-xs font-bold ${reaction.hasCurrentUser ? 'text-primary' : 'text-muted-foreground'}`}>
              {reaction.count}
            </span>
          </button>
        ))}
        
        {/* Add reaction button */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              className={`
                flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-200 
                ${hasReactions 
                  ? "border-muted-foreground/20 text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/5" 
                  : "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5"
                }
                hover:scale-105 active:scale-95
              `}
              onMouseDown={handleStopPropagation}
              onTouchStart={handleStopPropagation}
              disabled={disabled}
            >
              <Plus className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-auto p-1 border-none shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2" 
            align="start"
            onClick={handleStopPropagation}
            onMouseDown={handleStopPropagation}
            onTouchStart={handleStopPropagation}
          >
            <div className="bg-background/95 backdrop-blur-sm rounded-xl p-2 border shadow-xl">
              <div className="flex gap-1">
                {AVAILABLE_REACTIONS.map((reaction, index) => {
                  const existingReaction = reactions.find(r => r.reactionType === reaction.emoji)
                  const hasCurrentUser = existingReaction?.hasCurrentUser || false
                  return (
                    <button
                      key={reaction.emoji}
                      onClick={() => handlePickerReactionClick(reaction.emoji)}
                      onMouseDown={handleStopPropagation}
                      onTouchStart={handleStopPropagation}
                      className={`
                        group w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 
                        ${hasCurrentUser 
                          ? "bg-primary/15 border border-primary/30 shadow-sm" 
                          : "hover:bg-muted/80 border border-transparent hover:border-muted-foreground/20"
                        }
                        hover:scale-110 active:scale-95
                      `}
                      style={{ animationDelay: `${index * 30}ms` }}
                      title={reaction.name}
                    >
                      <span className="text-lg transition-transform group-hover:scale-110">
                        {reaction.emoji}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
} 