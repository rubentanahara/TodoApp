"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, X, Download, ExternalLink, ZoomIn, ZoomOut, Trash2 } from "lucide-react"

interface ImagePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  images: string[]
  initialIndex?: number
  noteAuthor?: string
  noteContent?: string
  isOwner?: boolean
  onDeleteImage?: (index: number) => void
}

export function ImagePreviewModal({ 
  isOpen, 
  onClose, 
  images, 
  initialIndex = 0,
  noteAuthor,
  noteContent,
  isOwner = false,
  onDeleteImage
}: ImagePreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isZoomed, setIsZoomed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
      setIsZoomed(false)
      setIsLoading(true)
    }
  }, [isOpen, initialIndex])

  const currentImage = images[currentIndex]
  const hasMultipleImages = images.length > 1

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => prev > 0 ? prev - 1 : images.length - 1)
    setIsZoomed(false)
    setIsLoading(true)
  }, [images.length])

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => prev < images.length - 1 ? prev + 1 : 0)
    setIsZoomed(false)
    setIsLoading(true)
  }, [images.length])

  const toggleZoom = useCallback(() => {
    setIsZoomed(prev => !prev)
  }, [])

  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(currentImage)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `image-${currentIndex + 1}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download image:', error)
    }
  }, [currentImage, currentIndex])

  const handleOpenInNewTab = useCallback(() => {
    window.open(currentImage, '_blank')
  }, [currentImage])

  const handleDeleteImage = useCallback(async () => {
    if (onDeleteImage && isOwner) {
      try {
        await onDeleteImage(currentIndex)
        
        // If this was the last image, close the modal
        if (images.length === 1) {
          onClose()
        } else {
          // Navigate to the next image, or previous if we're at the end
          if (currentIndex >= images.length - 1) {
            setCurrentIndex(prev => Math.max(0, prev - 1))
          }
        }
      } catch (error) {
        console.error('Error deleting image from modal:', error)
        // Don't close modal or change index if deletion failed
      }
    }
  }, [onDeleteImage, isOwner, currentIndex, images.length, onClose])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          if (hasMultipleImages) goToPrevious()
          break
        case 'ArrowRight':
          if (hasMultipleImages) goToNext()
          break
        case 'z':
        case 'Z':
          toggleZoom()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, hasMultipleImages, goToPrevious, goToNext, toggleZoom, onClose])

  const getDisplayName = (email: string): string => {
    return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const handleImageLoad = () => {
    setIsLoading(false)
  }

  const handleImageError = () => {
    setIsLoading(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full h-[95vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 pb-3 border-b flex-shrink-0">
          {/* Title row - clean and simple */}
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Image Preview
            </DialogTitle>
          </div>
          
          {/* Info row - author and photo count with proper spacing */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              {noteAuthor && (
                <Badge variant="secondary" className="text-xs">
                  by {getDisplayName(noteAuthor)}
                </Badge>
              )}
            </div>
            
            {hasMultipleImages && (
              <Badge variant="outline" className="text-xs">
                {currentIndex + 1} of {images.length}
              </Badge>
            )}
          </div>
          
          {/* Note content row */}
          {noteContent && (
            <div className="text-sm text-muted-foreground mt-3 max-h-12 overflow-hidden">
              {noteContent.length > 120 ? noteContent.substring(0, 120) + '...' : noteContent}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 relative flex items-center justify-center bg-black/5 dark:bg-black/20 min-h-0 overflow-hidden">
          {/* Navigation buttons */}
          {hasMultipleImages && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-background/80 hover:bg-background shadow-lg"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-background/80 hover:bg-background shadow-lg"
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}

          {/* Image container with maximum size constraints */}
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
            
            <img
              src={currentImage}
              alt={`Preview ${currentIndex + 1}`}
              className={`object-contain cursor-pointer transition-transform duration-300 ${
                isZoomed ? 'scale-125' : 'scale-100'
              } ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              onClick={toggleZoom}
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{
                maxHeight: '100%',
                maxWidth: '100%',
                height: 'auto',
                width: 'auto'
              }}
            />
          </div>

          {/* Zoom controls - slightly larger on mobile */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/90 rounded-full p-2 shadow-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleZoom}
              className="h-10 w-10 sm:h-8 sm:w-8 p-0"
              title={isZoomed ? "Zoom out (Z)" : "Zoom in (Z)"}
            >
              {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </Button>
            
            <div className="w-px h-4 bg-border" />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-10 w-10 sm:h-8 sm:w-8 p-0"
              title="Download image"
            >
              <Download className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenInNewTab}
              className="h-10 w-10 sm:h-8 sm:w-8 p-0"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            
            {/* Delete button - only visible for owners */}
            {isOwner && onDeleteImage && (
              <>
                <div className="w-px h-4 bg-border" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteImage}
                  className="h-10 w-10 sm:h-8 sm:w-8 p-0 hover:bg-red-500/20 hover:text-red-600"
                  title="Delete image"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Thumbnail strip for multiple images - always visible when multiple images exist */}
        {hasMultipleImages && (
          <div className="border-t p-4 flex-shrink-0 bg-background">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index)
                    setIsZoomed(false)
                    setIsLoading(true)
                  }}
                  className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all ${
                    index === currentIndex 
                      ? 'border-primary ring-2 ring-primary/20' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <img
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
} 