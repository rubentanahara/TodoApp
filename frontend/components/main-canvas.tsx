"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserSidebar } from "@/components/user-sidebar"
import { NoteCard } from "@/components/note-card"
import { Plus, LogOut, Menu, ZoomIn, ZoomOut, RotateCcw, Navigation, Maximize2, Minimize2, HelpCircle } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import { 
  useThrottledCallback, 
  useDebouncedCallback, 
  getViewportBounds, 
  isNoteInViewport, 
  getColorHash,
  getDisplayName,
  rafThrottle
} from "@/lib/performance"
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

interface User {
  email: string
  noteCount: number
  isOnline: boolean
  cursor?: { x: number; y: number }
  activeNoteId?: string
}

interface CanvasState {
  offset: { x: number; y: number }
  scale: number
  isPanning: boolean
  panStart: { x: number; y: number }
  lastOffset: { x: number; y: number }
  pinchStart?: { distance: number; scale: number }
}

interface MainCanvasProps {
  currentUser: string
  onSignOut: () => void
}

const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25
const CANVAS_SIZE = { width: 5000, height: 5000 }

export function MainCanvas({ currentUser, onSignOut }: MainCanvasProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [highlightedUsers, setHighlightedUsers] = useState<string[]>([])
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const { toast } = useToast()
  const isMobile = useIsMobile()
  
  // Enhanced canvas state
  const [canvas, setCanvas] = useState<CanvasState>({
    offset: { x: 0, y: 0 },
    scale: 1,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    lastOffset: { x: 0, y: 0 }
  })

  // Real-time collaboration state
  const [isConnected, setIsConnected] = useState(false)
  const [lastSync, setLastSync] = useState<Date>(new Date())
  const [activeCollaborators, setActiveCollaborators] = useState<string[]>([])

  const canvasRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Memoized color system with caching
  const getUserColor = useMemo(() => {
    const colors = [
      { 
        bg: 'bg-blue-500', 
        text: 'text-white', 
        border: 'border-blue-500', 
        ring: 'ring-blue-500',
        accent: 'bg-blue-600',
        accentLight: 'bg-blue-100'
      },
      { 
        bg: 'bg-green-500', 
        text: 'text-white', 
        border: 'border-green-500', 
        ring: 'ring-green-500',
        accent: 'bg-green-600',
        accentLight: 'bg-green-100'
      },
      { 
        bg: 'bg-purple-500', 
        text: 'text-white', 
        border: 'border-purple-500', 
        ring: 'ring-purple-500',
        accent: 'bg-purple-600',
        accentLight: 'bg-purple-100'
      },
      { 
        bg: 'bg-orange-500', 
        text: 'text-white', 
        border: 'border-orange-500', 
        ring: 'ring-orange-500',
        accent: 'bg-orange-600',
        accentLight: 'bg-orange-100'
      },
      { 
        bg: 'bg-pink-500', 
        text: 'text-white', 
        border: 'border-pink-500', 
        ring: 'ring-pink-500',
        accent: 'bg-pink-600',
        accentLight: 'bg-pink-100'
      },
      { 
        bg: 'bg-indigo-500', 
        text: 'text-white', 
        border: 'border-indigo-500', 
        ring: 'ring-indigo-500',
        accent: 'bg-indigo-600',
        accentLight: 'bg-indigo-100'
      },
      { 
        bg: 'bg-red-500', 
        text: 'text-white', 
        border: 'border-red-500', 
        ring: 'ring-red-500',
        accent: 'bg-red-600',
        accentLight: 'bg-red-100'
      },
      { 
        bg: 'bg-teal-500', 
        text: 'text-white', 
        border: 'border-teal-500', 
        ring: 'ring-teal-500',
        accent: 'bg-teal-600',
        accentLight: 'bg-teal-100'
      },
    ]
    
    return (email: string, isHighlighted: boolean = false) => {
      const hash = getColorHash(email)
      const baseColor = colors[Math.abs(hash) % colors.length]
      
      if (isHighlighted) {
        return {
          ...baseColor,
          bg: baseColor.bg.replace('-500', '-600')
        }
      }
      
      return baseColor
    }
  }, [])

  const getUserColorHex = useMemo(() => {
    const colorMap: { [key: string]: string } = {
      'bg-blue-500': '#3b82f6',
      'bg-green-500': '#10b981',
      'bg-purple-500': '#8b5cf6',
      'bg-orange-500': '#f97316',
      'bg-pink-500': '#ec4899',
      'bg-indigo-500': '#6366f1',
      'bg-red-500': '#ef4444',
      'bg-teal-500': '#14b8a6',
      'bg-blue-600': '#2563eb',
      'bg-green-600': '#059669',
      'bg-purple-600': '#7c3aed',
      'bg-orange-600': '#ea580c',
      'bg-pink-600': '#db2777',
      'bg-indigo-600': '#4f46e5',
      'bg-red-600': '#dc2626',
      'bg-teal-600': '#0d9488',
    }
    
    return (email: string, isHighlighted: boolean = false) => {
      const userColor = getUserColor(email, isHighlighted)
      const colorClass = userColor.bg
      return colorMap[colorClass] || '#3b82f6'
    }
  }, [getUserColor])

  // Memoized viewport bounds calculation
  const viewportBounds = useMemo(() => {
    if (!containerRef.current) return null
    
    const container = containerRef.current.getBoundingClientRect()
    return getViewportBounds(container.width, container.height, canvas.offset, canvas.scale)
  }, [canvas.offset, canvas.scale])

  // Memoized visible notes based on viewport culling
  const visibleNotes = useMemo(() => {
    if (!viewportBounds) return notes
    
    return notes.filter(note => 
      isNoteInViewport(note, viewportBounds)
    )
  }, [notes, viewportBounds])

  // Memoized visible online users (limit for performance)
  const visibleOnlineUsers = useMemo(() => {
    return users
      .filter(u => u.isOnline && u.email !== currentUser && u.cursor)
      .slice(0, 10) // Limit to 10 cursors for performance
  }, [users, currentUser])

  // RAF-based throttled move function for smoother performance
  const rafThrottledMoveNote = useRef(
    rafThrottle((id: string, x: number, y: number) => {
      setNotes(prev => prev.map(note => 
        note.id === id ? { ...note, x, y, lastModified: new Date() } : note
      ))
    })
  ).current

  // Debounced cursor updates for better performance
  const debouncedCursorUpdate = useDebouncedCallback(() => {
    setUsers(prev => prev.map(user => ({
      ...user,
      cursor: user.isOnline ? {
        x: Math.random() * 1000,
        y: Math.random() * 1000
      } : user.cursor
    })))
  }, 1000)

  // Initialize data and simulate real-time connection
  useEffect(() => {
    // Simulate connection
    setIsConnected(true)
    
    // TEMPORARY: Clear localStorage to test from clean state
    // Comment out these lines after testing
    if (window.location.search.includes('fresh=true')) {
      localStorage.removeItem("notes")
      localStorage.removeItem("users")
    }

    // Generate 100 demo users
    const generateUsers = () => {
      const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Leo', 'Maya', 'Noah', 'Olivia', 'Paul', 'Quinn', 'Ruby', 'Sam', 'Tina']
      const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin']
      const domains = ['example.com', 'demo.org', 'test.net', 'sample.io', 'workspace.dev']
      
      const users = []
      for (let i = 0; i < 100; i++) {
        const firstName = firstNames[i % firstNames.length]
        const lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length]
        const domain = domains[i % domains.length]
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i > 19 ? i - 19 : ''}@${domain}`
        users.push(email)
      }
      return users
    }

    // Generate 100 demo notes
    const generateNotes = (userEmails: string[]) => {
      const noteContents = [
        'Welcome to collaborative notes! 🎉\n\nThis is a sample note. You can drag any note from anywhere on the card!',
        'Real-time collaboration works seamlessly across devices 📱💻\n\nEveryone can edit and move notes!',
        'Try zooming with Ctrl+scroll or use the buttons.\n\nNavigation is smooth and intuitive! 🚀',
        'This is a team brainstorming session.\n\n💡 Ideas flow freely here!',
        'Project roadmap discussion\n\n📋 Let\'s plan our next sprint!',
        'Meeting notes from today\n\n📝 Action items and decisions',
        'Design feedback and iterations\n\n🎨 Visual improvements needed',
        'Code review comments\n\n🔍 Quality assurance notes',
        'Customer feedback summary\n\n👥 User experience insights',
        'Sprint planning session\n\n📊 Velocity and capacity planning',
        'Bug reports and fixes\n\n🐛 Technical debt tracking',
        'Feature specifications\n\n✨ New functionality requirements',
        'Marketing campaign ideas\n\n📢 Promotion strategies',
        'User research findings\n\n🔬 Data-driven insights',
        'Performance metrics review\n\n📈 Analytics and KPIs',
        'Team retrospective notes\n\n🔄 Continuous improvement',
        'Architecture decisions\n\n🏗️ Technical infrastructure',
        'Security audit results\n\n🔒 Vulnerability assessment',
        'Database optimization\n\n💾 Query performance tuning',
        'API documentation updates\n\n📚 Developer resources'
      ]
      
      const notes: Note[] = []
      for (let i = 0; i < 100; i++) {
        const author = userEmails[i % userEmails.length]
        const content = noteContents[i % noteContents.length]
        const x = Math.random() * 1500 + 100 // Spread across canvas
        const y = Math.random() * 1000 + 100
        const createdHours = Math.random() * 24 // Within last 24 hours
        
        notes.push({
          id: `note_${i + 1}`,
          content,
          author,
          createdAt: new Date(Date.now() - createdHours * 60 * 60 * 1000),
          lastModified: new Date(Date.now() - (createdHours * 0.5) * 60 * 60 * 1000),
          collaborators: [author],
          x,
          y,
        })
      }
      return notes
    }

    const demoUserEmails = generateUsers()
    const demoNotes = generateNotes(demoUserEmails)

    // Check for existing notes, if none exist, use demo notes
    const savedNotes = localStorage.getItem("notes")
    let notesToUse = demoNotes
    
    if (savedNotes) {
      try {
        const parsedNotes = JSON.parse(savedNotes)
        if (parsedNotes.length > 0) {
          notesToUse = parsedNotes.map((note: any) => ({
            ...note,
            createdAt: new Date(note.createdAt),
            lastModified: note.lastModified ? new Date(note.lastModified) : new Date(note.createdAt),
            collaborators: note.collaborators || []
          }))
        }
      } catch (e) {
        console.log("Error parsing saved notes, using demo notes")
        notesToUse = demoNotes
      }
    }

    // Set notes immediately
    setNotes(notesToUse)
    localStorage.setItem("notes", JSON.stringify(notesToUse))
    console.log("Notes loaded:", notesToUse)

    // Initialize users based on the notes we have
    let userList: User[] = []

    // Add current user
    userList.push({
      email: currentUser,
      noteCount: notesToUse.filter((note) => note.author === currentUser).length,
      isOnline: true,
      cursor: { x: 0, y: 0 }
    })

    // Add all demo users for collaboration simulation
    demoUserEmails.forEach((email) => {
      if (email !== currentUser) {
        userList.push({
          email,
          noteCount: notesToUse.filter((note) => note.author === email).length,
          isOnline: Math.random() > 0.3, // 70% chance to be online
          cursor: { x: Math.random() * 1000, y: Math.random() * 1000 }
        })
      }
    })

    // Set users and active collaborators
    setUsers(userList)
    setActiveCollaborators(userList.filter(u => u.isOnline && u.email !== currentUser).map(u => u.email))
    localStorage.setItem("users", JSON.stringify(userList))
    
    // Debug logging
    console.log("Users initialized:", userList)
    console.log("Active collaborators:", userList.filter(u => u.isOnline && u.email !== currentUser))

    // Simulate real-time updates with debounced cursor updates
    const syncInterval = setInterval(() => {
      setLastSync(new Date())
      debouncedCursorUpdate()
    }, 5000) // Increased interval from 3s to 5s for better performance

    return () => clearInterval(syncInterval)
  }, [currentUser, debouncedCursorUpdate])

  // Update user note counts when notes change (but not during initial load)
  useEffect(() => {
    // Only update if users are already initialized
    if (users.length > 0) {
      setUsers(prevUsers => {
        const updatedUsers = prevUsers.map((user) => ({
          ...user,
          noteCount: notes.filter((note) => note.author === user.email).length,
        }))
        localStorage.setItem("users", JSON.stringify(updatedUsers))
        
        // Debug logging
        console.log("Updated users with note counts:", updatedUsers)
        return updatedUsers
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes])

  // Save notes to localStorage
  useEffect(() => {
    localStorage.setItem("notes", JSON.stringify(notes))
  }, [notes])

  // Enhanced canvas pan handlers with zoom support
  const handleCanvasStart = useCallback((clientX: number, clientY: number) => {
    setCanvas(prev => ({
      ...prev,
      isPanning: true,
      panStart: { x: clientX, y: clientY },
      lastOffset: prev.offset
    }))
  }, [])

  const handleCanvasMove = useCallback((clientX: number, clientY: number) => {
    if (!canvas.isPanning) return

    const deltaX = clientX - canvas.panStart.x
    const deltaY = clientY - canvas.panStart.y

    setCanvas(prev => ({
      ...prev,
      offset: {
        x: prev.lastOffset.x + deltaX,
        y: prev.lastOffset.y + deltaY
      }
    }))
  }, [canvas.isPanning, canvas.panStart, canvas.lastOffset])

  const handleCanvasEnd = useCallback(() => {
    setCanvas(prev => ({ ...prev, isPanning: false }))
  }, [])

  // Canvas event handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCanvasStart(e.clientX, e.clientY)
    }
  }

  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (e.target === e.currentTarget) {
      if (e.touches.length === 1) {
        // Single touch - pan canvas
        e.preventDefault()
        const touch = e.touches[0]
        handleCanvasStart(touch.clientX, touch.clientY)
      } else if (e.touches.length === 2) {
        // Two finger pinch - zoom
        e.preventDefault()
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        
        // Calculate initial distance for pinch zoom
        const initialDistance = Math.hypot(
          touch1.clientX - touch2.clientX,
          touch1.clientY - touch2.clientY
        )
        
        // Store initial pinch data
        setCanvas(prev => ({
          ...prev,
          isPanning: false,
          pinchStart: { distance: initialDistance, scale: prev.scale }
        }))
      }
    }
  }

  // Zoom handlers
  const handleZoom = (delta: number, centerX?: number, centerY?: number) => {
    setCanvas(prev => {
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.scale + delta))
      
      if (centerX !== undefined && centerY !== undefined) {
        // Zoom towards a specific point
        const scaleRatio = newScale / prev.scale
        const newOffset = {
          x: centerX - (centerX - prev.offset.x) * scaleRatio,
          y: centerY - (centerY - prev.offset.y) * scaleRatio
        }
        
        return { ...prev, scale: newScale, offset: newOffset }
      }
      
      return { ...prev, scale: newScale }
    })
  }

  const handleWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Only zoom if Ctrl/Cmd is pressed OR if it's a trackpad pinch
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 50) {
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (containerRect) {
        // Calculate zoom center relative to container
        const centerX = e.clientX - containerRect.left
        const centerY = e.clientY - containerRect.top
        handleZoom(delta, centerX, centerY)
      }
    }
  }

  // Canvas control functions
  const zoomIn = () => handleZoom(ZOOM_STEP)
  const zoomOut = () => handleZoom(-ZOOM_STEP)
  const resetCanvas = () => {
    setCanvas(prev => ({
      ...prev,
      offset: { x: 0, y: 0 },
      scale: 1
    }))
  }

  const centerCanvas = () => {
    if (notes.length === 0) return
    
    const bounds = notes.reduce((acc, note) => ({
      minX: Math.min(acc.minX, note.x),
      maxX: Math.max(acc.maxX, note.x + 256),
      minY: Math.min(acc.minY, note.y),
      maxY: Math.max(acc.maxY, note.y + 128)
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })

    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    
    const container = containerRef.current
    if (container) {
      const containerRect = container.getBoundingClientRect()
      setCanvas(prev => ({
        ...prev,
        offset: {
          x: containerRect.width / 2 - centerX * prev.scale,
          y: containerRect.height / 2 - centerY * prev.scale
        }
      }))
    }
  }

  // Cross-platform keyboard shortcuts
  useEffect(() => {
    const preventZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
      }
    }

    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in inputs/textareas or on mobile
      const activeElement = document.activeElement
      const isEditing = activeElement?.tagName === 'INPUT' || 
                       activeElement?.tagName === 'TEXTAREA' || 
                       (activeElement as HTMLElement)?.contentEditable === 'true'

      // Skip keyboard shortcuts on mobile devices
      if (isMobile || isEditing) return

      // Cross-platform modifier key (Cmd on Mac, Ctrl on Windows/Linux)
      const isModifierPressed = e.metaKey || e.ctrlKey

      // Zoom In: Ctrl/Cmd + Plus or Ctrl/Cmd + =
      if (isModifierPressed && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        if (canvas.scale < MAX_ZOOM) {
          zoomIn()
        }
        return
      }

      // Zoom Out: Ctrl/Cmd + Minus
      if (isModifierPressed && e.key === '-') {
        e.preventDefault()
        if (canvas.scale > MIN_ZOOM) {
          zoomOut()
        }
        return
      }

      // Reset View: Ctrl/Cmd + 0
      if (isModifierPressed && e.key === '0') {
        e.preventDefault()
        resetCanvas()
        return
      }

      // Center on Notes: Ctrl/Cmd + H
      if (isModifierPressed && e.key.toLowerCase() === 'h') {
        e.preventDefault()
        centerCanvas()
        return
      }

      // Toggle Focus Mode: M (only when not editing)
      if (!isEditing && !isModifierPressed && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        setIsFocusMode(prev => !prev)
        return
      }

      // Create Note: Space (only when not editing)
      if (!isEditing && !isModifierPressed && e.key === ' ') {
        e.preventDefault()
        createNote()
        return
      }

      // Show Keyboard Help: ? (only when not editing)
      if (!isEditing && !isModifierPressed && (e.key === '?' || e.key === '/')) {
        e.preventDefault()
        setShowKeyboardHelp(prev => !prev)
        return
      }

      // Hide help on Escape
      if (e.key === 'Escape') {
        setShowKeyboardHelp(false)
        return
      }

      // Fit to Screen: Ctrl/Cmd + Shift + F
      if (isModifierPressed && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        centerCanvas()
        return
      }

      // Reset Demo Data: Ctrl/Cmd + Shift + R (for testing)
      if (isModifierPressed && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        resetDemoData()
        return
      }
    }

    // Only prevent wheel zoom on desktop
    if (!isMobile) {
      document.addEventListener('wheel', preventZoom, { passive: false })
    }
    
    document.addEventListener('keydown', handleKeyboardShortcuts)

    return () => {
      if (!isMobile) {
        document.removeEventListener('wheel', preventZoom)
      }
      document.removeEventListener('keydown', handleKeyboardShortcuts)
    }
      }, [canvas.scale, isMobile])

  // Add canvas pan event listeners with pinch zoom support
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleCanvasMove(e.clientX, e.clientY)
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && canvas.isPanning) {
        e.preventDefault()
        const touch = e.touches[0]
        handleCanvasMove(touch.clientX, touch.clientY)
      } else if (e.touches.length === 2 && canvas.pinchStart) {
        e.preventDefault()
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        
        // Calculate current distance
        const currentDistance = Math.hypot(
          touch1.clientX - touch2.clientX,
          touch1.clientY - touch2.clientY
        )
        
        // Calculate scale factor
        const scaleFactor = currentDistance / canvas.pinchStart.distance
        const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, canvas.pinchStart.scale * scaleFactor))
        
        // Calculate center point of pinch
        const centerX = (touch1.clientX + touch2.clientX) / 2
        const centerY = (touch1.clientY + touch2.clientY) / 2
        
        // Apply zoom with center point
        const containerRect = containerRef.current?.getBoundingClientRect()
        if (containerRect) {
          const relativeCenterX = centerX - containerRect.left
          const relativeCenterY = centerY - containerRect.top
          
          setCanvas(prev => ({
            ...prev,
            scale: newScale,
            offset: {
              x: relativeCenterX - (relativeCenterX - prev.offset.x) * (newScale / prev.scale),
              y: relativeCenterY - (relativeCenterY - prev.offset.y) * (newScale / prev.scale)
            }
          }))
        }
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        // All fingers lifted
        setCanvas(prev => ({
          ...prev,
          isPanning: false,
          pinchStart: undefined
        }))
      } else if (e.touches.length === 1 && canvas.pinchStart) {
        // One finger lifted during pinch, switch to pan
        setCanvas(prev => ({
          ...prev,
          pinchStart: undefined,
          isPanning: true,
          panStart: { x: e.touches[0].clientX, y: e.touches[0].clientY },
          lastOffset: prev.offset
        }))
      }
    }

    if (canvas.isPanning || canvas.pinchStart) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleCanvasEnd)
      document.addEventListener("touchmove", handleTouchMove, { passive: false })
      document.addEventListener("touchend", handleTouchEnd)

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleCanvasEnd)
        document.removeEventListener("touchmove", handleTouchMove)
        document.removeEventListener("touchend", handleTouchEnd)
      }
    }
  }, [canvas.isPanning, canvas.pinchStart, handleCanvasMove, handleCanvasEnd])

  // Enhanced note creation with viewport consideration
  const createNote = () => {
    const container = containerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const centerX = containerRect.width / 2
    const centerY = containerRect.height / 2

    // Convert viewport center to canvas coordinates
    const canvasX = (centerX - canvas.offset.x) / canvas.scale
    const canvasY = (centerY - canvas.offset.y) / canvas.scale

    const newNote: Note = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: "",
      author: currentUser,
      createdAt: new Date(),
      lastModified: new Date(),
      collaborators: [],
      x: canvasX - 128, // Center the note
      y: canvasY - 64,
    }
    
    setNotes((prev) => [...prev, newNote])
    
    // Simulate real-time broadcast
    setTimeout(() => {
      setActiveCollaborators(prev => [...prev.filter(c => c !== currentUser), currentUser])
    }, 100)
  }



  // Optimized note movement with RAF throttling
  const moveNote = useCallback((id: string, x: number, y: number) => {
    rafThrottledMoveNote(id, x, y)
  }, [rafThrottledMoveNote])

  // Optimized note update
  const updateNote = useCallback((id: string, content: string) => {
    setNotes(prev => prev.map(note => 
      note.id === id 
        ? { ...note, content, lastModified: new Date() }
        : note
    ))
  }, [])

  // Optimized note deletion
  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(note => note.id !== id))
  }, [])

  // Optimized user click handler with memoization
  const handleUserClick = useCallback((userEmail: string) => {
    const userDisplayName = getDisplayName(userEmail)
    
    if (highlightedUsers.includes(userEmail)) {
      const newHighlighted = highlightedUsers.filter(email => email !== userEmail)
      setHighlightedUsers(newHighlighted)
      toast({
        title: "User unhighlighted",
        description: `No longer highlighting ${userDisplayName}'s notes`,
        duration: 2000,
      })
    } else {
      const newHighlighted = [...highlightedUsers, userEmail]
      setHighlightedUsers(newHighlighted)
      const userNotes = notes.filter(note => note.author === userEmail)
      toast({
        title: `User highlighted`,
        description: `Now highlighting ${userDisplayName}'s ${userNotes.length} note${userNotes.length !== 1 ? 's' : ''}`,
        duration: 3000,
      })
    }
  }, [highlightedUsers, notes, toast])

  const handleLeaveGroup = () => {
    onSignOut()
  }

  // Add function to reset demo data
  const resetDemoData = () => {
    localStorage.removeItem("notes")
    localStorage.removeItem("users")
    window.location.reload()
  }

  // Focus mode - hide UI elements for better concentration

  // Keyboard shortcuts help component (desktop only)
  const KeyboardHelp = () => {
    if (!showKeyboardHelp || isMobile) return null

    const shortcuts = [
      { key: 'Ctrl/⌘ + +', action: 'Zoom In' },
      { key: 'Ctrl/⌘ + -', action: 'Zoom Out' },
      { key: 'Ctrl/⌘ + 0', action: 'Reset View' },
      { key: 'Ctrl/⌘ + H', action: 'Center on Notes' },
      { key: 'M', action: 'Toggle Focus Mode (Hide/Show UI)' },
      { key: 'Space', action: 'Create Note' },
      { key: '?', action: 'Show/Hide This Help' },
      { key: 'Esc', action: 'Close Help' },
      { key: 'Ctrl/⌘ + ⇧ + R', action: 'Reset Demo Data' },
    ]

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-background border rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKeyboardHelp(false)}
              className="h-8 w-8 p-0"
            >
              ×
            </Button>
          </div>
          <div className="space-y-2">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{shortcut.action}</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
            <p>💡 Shortcuts work when not editing text</p>
            <p>⌘ = Cmd key on Mac, Ctrl key on Windows/Linux</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex">
        {/* Desktop Sidebar - Hidden in focus mode */}
        {!isFocusMode && (
          <div className="hidden lg:block">
            <UserSidebar
              users={users}
              currentUser={currentUser}
              highlightedUsers={highlightedUsers}
              onUserClick={handleUserClick}
              getUserColor={(email: string) => getUserColor(email, false)}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Enhanced Header with Connection Status - Hidden in focus mode */}
          {!isFocusMode && (
            <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
            <div className="flex h-14 items-center justify-between px-4">
              <div className="flex items-center gap-3">
                {/* Mobile Menu Button - Hidden in focus mode */}
                {!isFocusMode && (
                  <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="sm" className="lg:hidden">
                        <Menu className="w-5 h-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-80">
                      <UserSidebar
                        users={users}
                        currentUser={currentUser}
                        highlightedUsers={highlightedUsers}
                        onUserClick={(email) => {
                          handleUserClick(email)
                          setIsMobileSidebarOpen(false)
                        }}
                        getUserColor={(email: string) => getUserColor(email, false)}
                      />
                    </SheetContent>
                  </Sheet>
                )}
                
                <div className="flex items-center gap-2">
                  <h1 className="font-semibold text-sm sm:text-base">Collaborative Notes</h1>
                  <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
                    {isConnected ? "Live" : "Offline"}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{activeCollaborators.length} active</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>Zoom: {Math.round(canvas.scale * 100)}%</span>
                </div>
                <ThemeToggle />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs sm:text-sm bg-transparent">
                      <LogOut className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Leave Group</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="mx-4 max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Leave Group</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to leave this group? You will be signed out and returned to the sign-in screen.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLeaveGroup} className="w-full sm:w-auto">
                        Leave Group
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </header>
          )}

          {/* Enhanced Canvas with Zoom and Pan */}
          <div 
            ref={containerRef}
            className="flex-1 relative overflow-hidden"
            onWheel={handleWheelZoom}
          >
            <div
              ref={canvasRef}
              data-canvas="true"
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
              onMouseDown={handleCanvasMouseDown}
              onTouchStart={handleCanvasTouchStart}
              style={{
                transform: `translate(${canvas.offset.x}px, ${canvas.offset.y}px) scale(${canvas.scale})`,
                transformOrigin: '0 0',
                transition: canvas.isPanning ? "none" : "transform 0.2s ease-out",
                width: CANVAS_SIZE.width,
                height: CANVAS_SIZE.height,
              }}
            >
              {/* Canvas Grid (optional) */}
              <div 
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                    linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
                  `,
                  backgroundSize: '50px 50px',
                }}
              />

              {/* Empty State */}
              {notes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="text-center space-y-4 max-w-md">
                    <h2 className="text-xl sm:text-2xl font-semibold text-muted-foreground">
                      Welcome to your collaborative canvas
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      Start collaborating by creating your first note. You can drag any note, zoom in/out, and navigate freely.
                    </p>
                    <Button onClick={createNote} size="lg" className="w-full sm:w-auto">
                      <Plus className="w-5 h-5 mr-2" />
                      Create Note
                    </Button>
                  </div>
                </div>
              )}

              {/* Render only visible notes for better performance */}
              {visibleNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  isOwner={note.author === currentUser}
                  isHighlighted={highlightedUsers.includes(note.author)}
                  canDrag={true}
                  userColor={getUserColor(note.author, false)}
                  onUpdate={updateNote}
                  onDelete={deleteNote}
                  onMove={moveNote}
                />
              ))}

              {/* Collaborative Cursors - Limited for performance */}
              {visibleOnlineUsers.map((user) => {
                const userColor = getUserColorHex(user.email, highlightedUsers.includes(user.email))
                const displayName = getDisplayName(user.email)
                return (
                  <div
                    key={user.email}
                    className="absolute pointer-events-none z-50"
                    style={{
                      left: user.cursor!.x,
                      top: user.cursor!.y,
                      transform: 'translate(-2px, -2px)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border-2 border-white shadow-lg" 
                        style={{ backgroundColor: userColor }}
                      />
                      <div 
                        className="text-white px-2 py-1 rounded text-xs font-medium whitespace-nowrap"
                        style={{ backgroundColor: userColor }}
                      >
                        {displayName}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Canvas Controls - Always visible and properly positioned */}
            {isMobile ? (
              // Mobile: Bottom toolbar
              <div className="fixed bottom-4 left-4 right-4 flex justify-center z-30">
                <div className="flex gap-2 bg-background/95 backdrop-blur border rounded-full px-4 py-2 shadow-lg">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={zoomOut}
                        disabled={canvas.scale <= MIN_ZOOM}
                        className="h-10 w-10 rounded-full"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Zoom Out</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={zoomIn}
                        disabled={canvas.scale >= MAX_ZOOM}
                        className="h-10 w-10 rounded-full"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Zoom In</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={resetCanvas} className="h-10 w-10 rounded-full">
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset View</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={centerCanvas} className="h-10 w-10 rounded-full">
                        <Navigation className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Center on Notes</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ) : (
              // Desktop: Fixed positioned controls - next to sidebar when visible
              <div className={`fixed bottom-4 ${isFocusMode ? 'left-4' : 'left-[272px]'} flex flex-col gap-2 z-30`}>
                <div className="flex flex-col gap-1 bg-background/95 backdrop-blur border rounded-lg p-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={zoomIn}
                        disabled={canvas.scale >= MAX_ZOOM}
                      >
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Zoom In (Ctrl/⌘ + +)</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={zoomOut}
                        disabled={canvas.scale <= MIN_ZOOM}
                      >
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Zoom Out (Ctrl/⌘ + -)</TooltipContent>
                  </Tooltip>
                  
                  <Separator />
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={resetCanvas}>
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset View (Ctrl/⌘ + 0)</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={centerCanvas}>
                        <Navigation className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Center on Notes (Ctrl/⌘ + H)</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsFocusMode(!isFocusMode)}
                      >
                        {isFocusMode ? (
                          <Minimize2 className="w-4 h-4" />
                        ) : (
                          <Maximize2 className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isFocusMode ? 'Exit Focus Mode (M)' : 'Enter Focus Mode (M)'}
                    </TooltipContent>
                  </Tooltip>
                  
                  <Separator />
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
                      >
                        <HelpCircle className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Keyboard Shortcuts (?)</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}

            {/* Add Note Button - Positioned for optimal access */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={createNote}
                  className={`fixed ${
                    isMobile 
                      ? "bottom-20 right-4 h-14 w-14" 
                      : "bottom-4 right-4 h-12 w-12"
                  } rounded-full shadow-lg z-40 hover:scale-105 transition-transform touch-manipulation`}
                  size="icon"
                >
                  <Plus className={`${isMobile ? "w-6 h-6" : "w-5 h-5"}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Note {!isMobile && "(Space)"}</TooltipContent>
            </Tooltip>

            {/* Focus Mode - UI elements are conditionally hidden */}
          </div>
        </div>
        
        {/* Keyboard Shortcuts Help */}
        <KeyboardHelp />
      </div>
    </TooltipProvider>
  )
}
