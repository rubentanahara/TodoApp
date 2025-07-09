import { useCallback, useRef } from 'react'

// Throttle function for performance optimization
export const throttle = (func: Function, limit: number) => {
  let inThrottle: boolean
  return function (this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// RAF-based throttle for smoother animations
export const rafThrottle = (func: Function) => {
  let rafId: number | null = null
  return function (this: any, ...args: any[]) {
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, args)
        rafId = null
      })
    }
  }
}

// Debounce function for performance optimization
export const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout
  return function (this: any, ...args: any[]) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}

// Custom hook for throttled callbacks
export const useThrottledCallback = (callback: Function, delay: number) => {
  const throttledCallback = useRef(throttle(callback, delay))
  
  return useCallback((...args: any[]) => {
    throttledCallback.current(...args)
  }, [])
}

// Custom hook for debounced callbacks
export const useDebouncedCallback = (callback: Function, delay: number) => {
  const debouncedCallback = useRef(debounce(callback, delay))
  
  return useCallback((...args: any[]) => {
    debouncedCallback.current(...args)
  }, [])
}

// Viewport culling for canvas items
export const isInViewport = (
  item: { x: number; y: number; width: number; height: number },
  viewport: { x: number; y: number; width: number; height: number; scale: number }
) => {
  const itemLeft = item.x * viewport.scale + viewport.x
  const itemTop = item.y * viewport.scale + viewport.y
  const itemRight = itemLeft + item.width * viewport.scale
  const itemBottom = itemTop + item.height * viewport.scale

  return (
    itemRight >= 0 &&
    itemLeft <= viewport.width &&
    itemBottom >= 0 &&
    itemTop <= viewport.height
  )
}

// Memoized color hash function
const colorCache = new Map<string, number>()

export const getColorHash = (email: string): number => {
  if (colorCache.has(email)) {
    return colorCache.get(email)!
  }

  let hash = 0
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  colorCache.set(email, hash)
  return hash
}

// Efficient viewport bounds calculation
export const getViewportBounds = (
  containerWidth: number,
  containerHeight: number,
  offset: { x: number; y: number },
  scale: number
) => {
  return {
    left: -offset.x / scale,
    top: -offset.y / scale,
    right: (-offset.x + containerWidth) / scale,
    bottom: (-offset.y + containerHeight) / scale,
  }
}

// Check if a note is within viewport bounds
export const isNoteInViewport = (
  note: { x: number; y: number },
  bounds: { left: number; top: number; right: number; bottom: number },
  noteWidth: number = 256,
  noteHeight: number = 128
) => {
  return (
    note.x + noteWidth >= bounds.left &&
    note.x <= bounds.right &&
    note.y + noteHeight >= bounds.top &&
    note.y <= bounds.bottom
  )
}

// Batch updates for better performance
export const batchUpdates = (updates: Array<() => void>) => {
  requestAnimationFrame(() => {
    updates.forEach(update => update())
  })
}

// Memoized display name extraction
const displayNameCache = new Map<string, string>()

export const getDisplayName = (email: string): string => {
  if (displayNameCache.has(email)) {
    return displayNameCache.get(email)!
  }

  const displayName = email.split("@")[0]
  displayNameCache.set(email, displayName)
  return displayName
}

// Clear caches if needed (for memory management)
export const clearCaches = () => {
  colorCache.clear()
  displayNameCache.clear()
} 