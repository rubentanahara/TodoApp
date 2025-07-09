"use client"

import type React from "react"
import { useState, useRef, useEffect, memo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, GripVertical } from "lucide-react"
import { throttle, rafThrottle, getDisplayName } from "@/lib/performance"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Note {
  id: string
  content: string
  author: string
  createdAt: Date
  x: number
  y: number
  lastModified?: Date
  collaborators?: string[]
}

interface NoteCardProps {
  note: Note
  isOwner: boolean
  isHighlighted: boolean
  canDrag?: boolean
  userColor: { bg: string; text: string; border: string; ring: string; accent: string; accentLight: string }
  onUpdate: (id: string, content: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
}

const NoteCard = memo(({ note, isOwner, isHighlighted, canDrag = isOwner, userColor, onUpdate, onDelete, onMove }: NoteCardProps) => {
  const [isEditing, setIsEditing] = useState(note.content === "")
  const [content, setContent] = useState(note.content)
  const [isDragging, setIsDragging] = useState(false)
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 }) // Offset from mouse to note corner
  const [currentPosition, setCurrentPosition] = useState({ x: note.x, y: note.y })
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Memoize display name calculation
  const displayName = getDisplayName(note.author)

  // Memoize time string
  const timeString = note.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  // RAF-based throttled move for data persistence only
  const rafThrottledMove = useRef(
    rafThrottle((id: string, x: number, y: number) => {
      onMove(id, x, y)
    })
  ).current

  // Update position to follow mouse cursor exactly
  const updatePositionToMouse = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return
    
    // Get canvas element and its transform container
    const canvas = cardRef.current?.closest('[data-canvas]')
    const container = canvas?.parentElement
    
    if (canvas && container) {
      const containerRect = container.getBoundingClientRect()
      
      // Calculate mouse position relative to container
      const containerMouseX = clientX - containerRect.left
      const containerMouseY = clientY - containerRect.top
      
      // Get canvas transform from style (scale and translate)
      const canvasStyle = getComputedStyle(canvas)
      const transform = canvasStyle.transform
      
      // Parse transform matrix to get scale and translate values
      let scale = 1
      let translateX = 0
      let translateY = 0
      
      if (transform && transform !== 'none') {
        const matrixMatch = transform.match(/matrix\((.*?)\)/)
        if (matrixMatch) {
          const values = matrixMatch[1].split(',').map(v => parseFloat(v.trim()))
          if (values.length >= 6) {
            scale = values[0] // scaleX
            translateX = values[4] // translateX
            translateY = values[5] // translateY
          }
        }
      }
      
      // Convert mouse coordinates to canvas coordinate space
      const canvasMouseX = (containerMouseX - translateX) / scale
      const canvasMouseY = (containerMouseY - translateY) / scale
      
      // Calculate exact note position based on mouse and initial offset
      const newX = canvasMouseX - mouseOffset.x
      const newY = canvasMouseY - mouseOffset.y
      
      // Immediate visual update - note follows mouse exactly
      setCurrentPosition({ x: newX, y: newY })
      
      // Throttled data update for performance
      rafThrottledMove(note.id, newX, newY)
    } else {
      // Fallback: direct positioning
      const newX = clientX - mouseOffset.x
      const newY = clientY - mouseOffset.y
      
      setCurrentPosition({ x: newX, y: newY })
      rafThrottledMove(note.id, newX, newY)
    }
  }, [isDragging, mouseOffset, note.id, rafThrottledMove])

  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window)
  }, [])

  // Update current position when note position changes externally
  useEffect(() => {
    if (!isDragging) {
      setCurrentPosition({ x: note.x, y: note.y })
    }
  }, [note.x, note.y, isDragging])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      
      if (isTouchDevice) {
        setTimeout(() => {
          textareaRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          })
        }, 300)
      }
    }
  }, [isEditing, isTouchDevice])

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    onUpdate(note.id, newContent)
  }, [note.id, onUpdate])

  const handleStart = useCallback((clientX: number, clientY: number, e: any) => {
    if (!canDrag || isEditing) return
    e.stopPropagation()
    
    // Calculate initial offset from mouse to note's current position in canvas coordinates
    const canvas = cardRef.current?.closest('[data-canvas]')
    const container = canvas?.parentElement
    
    if (canvas && container) {
      const containerRect = container.getBoundingClientRect()
      
      // Calculate mouse position relative to container
      const containerMouseX = clientX - containerRect.left
      const containerMouseY = clientY - containerRect.top
      
      // Get canvas transform from style (scale and translate)
      const canvasStyle = getComputedStyle(canvas)
      const transform = canvasStyle.transform
      
      // Parse transform matrix to get scale and translate values
      let scale = 1
      let translateX = 0
      let translateY = 0
      
      if (transform && transform !== 'none') {
        const matrixMatch = transform.match(/matrix\((.*?)\)/)
        if (matrixMatch) {
          const values = matrixMatch[1].split(',').map(v => parseFloat(v.trim()))
          if (values.length >= 6) {
            scale = values[0] // scaleX
            translateX = values[4] // translateX
            translateY = values[5] // translateY
          }
        }
      }
      
      // Convert mouse coordinates to canvas coordinate space
      const canvasMouseX = (containerMouseX - translateX) / scale
      const canvasMouseY = (containerMouseY - translateY) / scale
      
      // Calculate offset from mouse to note position
      setMouseOffset({
        x: canvasMouseX - note.x,
        y: canvasMouseY - note.y
      })
    } else {
      // Fallback: assume mouse is at center of note
      setMouseOffset({ x: 128, y: 64 })
    }
    
    setIsDragging(true)
    setCurrentPosition({ x: note.x, y: note.y })
  }, [canDrag, isEditing, note.x, note.y])

  const handleMove = useCallback((clientX: number, clientY: number) => {
    updatePositionToMouse(clientX, clientY)
  }, [updatePositionToMouse])

  const handleEnd = useCallback(() => {
    if (isDragging) {
      // Final position update when drag ends
      onMove(note.id, currentPosition.x, currentPosition.y)
      setIsDragging(false)
    }
  }, [isDragging, note.id, currentPosition, onMove])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY, e)
  }, [handleStart])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      handleStart(touch.clientX, touch.clientY, e)
    }
  }, [handleStart])

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isOwner) setIsEditing(true)
  }, [isOwner])

  const handleDelete = useCallback(() => {
    onDelete(note.id)
  }, [note.id, onDelete])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsEditing(false)
    }
  }, [])

  const handleStopPropagation = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
  }, [])

  const handleOwnerStopPropagation = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isOwner) e.stopPropagation()
  }, [isOwner])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      handleMove(e.clientX, e.clientY)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault()
        const touch = e.touches[0]
        handleMove(touch.clientX, touch.clientY)
      }
    }

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove, { passive: false })
      document.addEventListener("mouseup", handleEnd)
      document.addEventListener("touchmove", handleTouchMove, { passive: false })
      document.addEventListener("touchend", handleEnd)

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleEnd)
        document.removeEventListener("touchmove", handleTouchMove)
        document.removeEventListener("touchend", handleEnd)
      }
    }
  }, [isDragging, handleMove, handleEnd])

  return (
    <Card
      ref={cardRef}
      className={`absolute w-56 sm:w-64 min-h-28 sm:min-h-32 p-2 sm:p-3 select-none ${
        isHighlighted 
          ? `ring-2 ${userColor.ring} shadow-xl` 
          : "shadow-md"
      } ${isDragging ? "scale-105 shadow-xl z-50 rotate-2" : ""} ${
        canDrag && !isEditing ? "cursor-grab active:cursor-grabbing hover:shadow-lg hover:scale-105" : "cursor-default"
      } ${isDragging ? "" : "transition-all duration-200"}`}
      style={{
        left: isDragging ? currentPosition.x : note.x,
        top: isDragging ? currentPosition.y : note.y,
        zIndex: isDragging ? 50 : isHighlighted ? 20 : 10,
        touchAction: canDrag && !isEditing ? "none" : "auto",
        willChange: isDragging ? "transform" : "auto",
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge className={`text-xs ${userColor.bg} ${userColor.text} border-0`}>
            {displayName}
          </Badge>
          {isHighlighted && (
            <div className="text-xs text-muted-foreground font-medium">
              highlighted
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isOwner && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 sm:h-6 sm:w-6 p-0 hover:bg-destructive hover:text-destructive-foreground touch-manipulation"
                  onClick={handleStopPropagation}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="mx-4 max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Note</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this note? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canDrag && (
            <GripVertical className={`w-4 h-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          )}
        </div>
      </div>

      {isEditing && isOwner ? (
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Start typing your note..."
          className="min-h-16 sm:min-h-20 resize-none border-none p-0 focus-visible:ring-0 text-sm sm:text-base"
          onClick={handleStopPropagation}
          onMouseDown={handleStopPropagation}
          onTouchStart={handleStopPropagation}
        />
      ) : (
        <div
          className={`min-h-16 sm:min-h-20 text-sm whitespace-pre-wrap ${
            isOwner ? "cursor-text" : "cursor-default"
          } ${content ? "" : "text-muted-foreground italic"}`}
          onClick={handleEditClick}
          onMouseDown={handleOwnerStopPropagation}
          onTouchStart={handleOwnerStopPropagation}
        >
          {content || "Tap to add content..."}
        </div>
      )}

      <div className="text-xs text-muted-foreground mt-2">
        {timeString}
      </div>
    </Card>
  )
})

NoteCard.displayName = "NoteCard"

export { NoteCard }
