"use client"

import React, { useState, useRef, useCallback, useEffect, memo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, GripVertical, Save, X } from "lucide-react"
import { Note } from "@/types/api"
import { rafThrottle, useDebouncedCallback } from "@/lib/performance"

// Helper function to get display name from email
const getDisplayName = (email: string): string => {
  return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
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
  const [isEditing, setIsEditing] = useState(isOwner && (note.content === "" || note.content === "New note"))
  const [content, setContent] = useState(note.content)
  const [originalContent, setOriginalContent] = useState(note.content)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
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

  // Debounced move for backend persistence with longer delay to prevent flooding
  const debouncedMove = useRef(
    useDebouncedCallback((id: string, x: number, y: number) => {
      onMove(id, x, y)
    }, 500) // 500ms debounce - only send to backend after user stops moving for 500ms
  ).current

  // RAF-based throttled move for immediate visual feedback only
  const rafThrottledVisualUpdate = useRef(
    rafThrottle((x: number, y: number) => {
      setCurrentPosition({ x, y })
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
      rafThrottledVisualUpdate(newX, newY)
      
      // Debounced backend update - only sends after user stops moving
      debouncedMove(note.id, newX, newY)
    } else {
      // Fallback: direct positioning
      const newX = clientX - mouseOffset.x
      const newY = clientY - mouseOffset.y
      
      rafThrottledVisualUpdate(newX, newY)
      debouncedMove(note.id, newX, newY)
    }
  }, [isDragging, mouseOffset, note.id, rafThrottledVisualUpdate, debouncedMove])

  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window)
  }, [])

  // Update content and original content when note prop changes
  useEffect(() => {
    if (note.content !== originalContent && !isEditing) {
      setContent(note.content)
      setOriginalContent(note.content)
      setHasUnsavedChanges(false)
    }
  }, [note.content, originalContent, isEditing])

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
    setHasUnsavedChanges(newContent !== originalContent)
  }, [originalContent])

  const handleSave = useCallback(async () => {
    if (!hasUnsavedChanges || isSaving) return
    
    // Validate content is not empty
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      // Show error feedback - could use a toast here if available
      console.warn('Cannot save note with empty content')
      return
    }
    
    setIsSaving(true)
    try {
      await onUpdate(note.id, trimmedContent)
      setOriginalContent(trimmedContent)
      setContent(trimmedContent)
      setHasUnsavedChanges(false)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save note:', error)
      // Optionally show an error toast here
    } finally {
      setIsSaving(false)
    }
  }, [hasUnsavedChanges, isSaving, onUpdate, note.id, content])

  const handleCancel = useCallback(() => {
    setContent(originalContent)
    setHasUnsavedChanges(false)
    setIsEditing(false)
  }, [originalContent])

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
      setIsDragging(false)
      // Force a final update to backend when dragging ends
      debouncedMove.flush()
    }
  }, [isDragging, debouncedMove])

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
    if (isOwner) {
      setIsEditing(true)
    }
  }, [isOwner])

  const handleDelete = useCallback(() => {
    onDelete(note.id)
  }, [note.id, onDelete])

  const handleBlur = useCallback(() => {
    // Only exit editing if no unsaved changes, otherwise keep editing mode
    if (!hasUnsavedChanges) {
      setIsEditing(false)
    }
  }, [hasUnsavedChanges])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel()
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSave()
    }
  }, [handleCancel, handleSave])

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

  // Cancel any pending debounced calls when component unmounts
  useEffect(() => {
    return () => {
      debouncedMove.cancel()
    }
  }, [debouncedMove])

  return (
    <Card
      ref={cardRef}
      className={`absolute w-56 sm:w-64 min-h-28 sm:min-h-32 p-2 sm:p-3 select-none ${
        isHighlighted 
          ? `ring-2 ${userColor.ring} shadow-xl` 
          : "shadow-md"
      } ${isDragging ? "scale-105 shadow-xl z-50 rotate-2" : ""} ${
        hasUnsavedChanges ? "ring-2 ring-yellow-400 shadow-lg" : ""
      } ${
        canDrag && !isEditing 
          ? `cursor-grab active:cursor-grabbing hover:shadow-lg hover:scale-105 ${!isOwner ? 'hover:ring-1 hover:ring-blue-300' : ''}` 
          : "cursor-default"
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
      <div className="flex justify-between items-start mb-2">
        <div className={`text-xs font-medium px-2 py-1 rounded-full ${userColor.bg} ${userColor.text} flex items-center gap-1`}>
          <div className={`w-2 h-2 rounded-full ${userColor.accent}`} />
          {displayName}
          {hasUnsavedChanges && (
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Unsaved changes" />
          )}
        </div>

        <div className="flex items-center gap-1">
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
              onMouseDown={handleStopPropagation}
              onTouchStart={handleStopPropagation}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
          
          {canDrag && !isEditing && (
            <div className="flex items-center gap-0.5" title={isOwner ? "Drag to move" : "Anyone can move this note"}>
              <GripVertical className={`w-4 h-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'} ${!isOwner ? 'opacity-70' : ''}`} />
            </div>
          )}
        </div>
      </div>

      {isEditing && isOwner ? (
        <div className="space-y-2">
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
          
          {hasUnsavedChanges && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="h-7 px-2 text-xs flex items-center gap-1"
                onMouseDown={handleStopPropagation}
                onTouchStart={handleStopPropagation}
              >
                <Save className="w-3 h-3" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-7 px-2 text-xs hover:bg-destructive/20 hover:text-destructive flex items-center gap-1"
                onMouseDown={handleStopPropagation}
                onTouchStart={handleStopPropagation}
              >
                <X className="w-3 h-3" />
                Cancel
              </Button>
              
              <div className="text-xs text-muted-foreground ml-auto">
                Ctrl+Enter to save, Esc to cancel
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`min-h-16 sm:min-h-20 text-sm whitespace-pre-wrap ${
            isOwner ? "cursor-text" : "cursor-default"
          } ${content ? "" : "text-muted-foreground italic"}`}
          onClick={handleEditClick}
          onMouseDown={handleOwnerStopPropagation}
          onTouchStart={handleOwnerStopPropagation}
        >
          {content ? content : "Tap to add content..."}
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
