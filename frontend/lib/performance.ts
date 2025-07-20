import { useCallback, useRef } from 'react'

// Interface for debounced function with control methods
interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void
  flush(): void
  cancel(): void
}

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

// Enhanced debounce function with flush and cancel methods
export const debounce = <T extends (...args: any[]) => any>(func: T, wait: number): DebouncedFunction<T> => {
  let timeout: NodeJS.Timeout | null = null
  let lastArgs: Parameters<T> | null = null
  let lastThis: any = null

  const debounced = function (this: any, ...args: Parameters<T>) {
    lastArgs = args
    lastThis = this
    
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      func.apply(lastThis, lastArgs!)
      timeout = null
    }, wait)
  } as DebouncedFunction<T>

  debounced.flush = function () {
    if (timeout && lastArgs) {
      clearTimeout(timeout)
      func.apply(lastThis, lastArgs)
      timeout = null
      lastArgs = null
      lastThis = null
    }
  }

  debounced.cancel = function () {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
      lastArgs = null
      lastThis = null
    }
  }

  return debounced
}

// Custom hook for throttled callbacks
export const useThrottledCallback = (callback: Function, delay: number) => {
  const throttledCallback = useRef(throttle(callback, delay))
  
  return useCallback((...args: any[]) => {
    throttledCallback.current(...args)
  }, [])
}

// Enhanced custom hook for debounced callbacks with control methods
export const useDebouncedCallback = <T extends (...args: any[]) => any>(callback: T, delay: number): DebouncedFunction<T> => {
  const debouncedCallbackRef = useRef(debounce(callback, delay))
  
  // Update the callback reference when callback or delay changes
  const callbackRef = useRef(callback)
  callbackRef.current = callback
  
  const wrappedCallback = useCallback((...args: Parameters<T>) => {
    debouncedCallbackRef.current(...args)
  }, []) as DebouncedFunction<T>

  // Add control methods
  wrappedCallback.flush = useCallback(() => {
    debouncedCallbackRef.current.flush()
  }, [])

  wrappedCallback.cancel = useCallback(() => {
    debouncedCallbackRef.current.cancel()
  }, [])

  return wrappedCallback
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
  // Handle undefined, null, or empty email
  if (!email || typeof email !== 'string') {
    return 'Unknown User'
  }

  if (displayNameCache.has(email)) {
    return displayNameCache.get(email)!
  }

  // Handle emails that don't contain '@' symbol
  const atIndex = email.indexOf('@')
  const displayName = atIndex > 0 ? email.substring(0, atIndex) : email

  displayNameCache.set(email, displayName)
  return displayName
}

// Clear caches if needed (for memory management)
export const clearCaches = () => {
  colorCache.clear()
  displayNameCache.clear()
} 