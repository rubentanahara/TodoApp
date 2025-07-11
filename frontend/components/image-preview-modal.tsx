"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, X, Download, ExternalLink, ZoomIn, ZoomOut } from "lucide-react"

interface ImagePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  images: string[]
  initialIndex?: number
  noteAuthor?: string
  noteContent?: string
}

export function ImagePreviewModal({ 
  isOpen, 
  onClose, 
  images, 
  initialIndex = 0,
  noteAuthor,
  noteContent 
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
      <DialogContent className="max-w-5xl w-full h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg font-semibold">
                Image Preview
              </DialogTitle>
              {noteAuthor && (
                <Badge variant="secondary" className="text-xs">
                  by {getDisplayName(noteAuthor)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasMultipleImages && (
                <Badge variant="outline" className="text-xs">
                  {currentIndex + 1} of {images.length}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {noteContent && (
            <div className="text-sm text-muted-foreground mt-2 max-h-10 overflow-hidden">
              {noteContent.length > 100 ? noteContent.substring(0, 100) + '...' : noteContent}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 relative flex items-center justify-center bg-black/5 dark:bg-black/20">
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

          {/* Image container */}
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
            
            <img
              src={currentImage}
              alt={`Preview ${currentIndex + 1}`}
              className={`max-w-full max-h-full object-contain cursor-pointer transition-transform duration-300 ${
                isZoomed ? 'scale-150' : 'scale-100'
              } ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              onClick={toggleZoom}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/80 rounded-full p-2 shadow-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleZoom}
              className="h-8 w-8 p-0"
              title={isZoomed ? "Zoom out (Z)" : "Zoom in (Z)"}
            >
              {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </Button>
            
            <div className="w-px h-4 bg-border" />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-8 w-8 p-0"
              title="Download image"
            >
              <Download className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenInNewTab}
              className="h-8 w-8 p-0"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Thumbnail strip for multiple images */}
        {hasMultipleImages && (
          <div className="border-t p-4">
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