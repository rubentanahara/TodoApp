"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserSidebar } from "@/components/user-sidebar"
import { NoteCard } from "@/components/note-card"
import { Plus, LogOut, Menu, ZoomIn, ZoomOut, RotateCcw, Navigation, Maximize2, Minimize2, HelpCircle, AlertCircle } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import { 
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
// Backend integration imports
import { useAuth } from "@/lib/auth"
import { apiService } from "@/lib/api"
import { useSignalR } from "@/lib/signalr"
import { config } from "@/lib/config"
import { Note, User, NoteDto, NoteCreateDto, NoteUpdateDto, NoteReactionDto } from "@/types/api"

// Using types from backend integration
// Note and User types are imported from @/types/api

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

const MIN_ZOOM = 0.5  // 50% minimum zoom
const MAX_ZOOM = 1.5  // 150% maximum zoom
const ZOOM_STEP = 0.25
const CANVAS_SIZE = { width: 5000, height: 5000 }

export function MainCanvas({ currentUser, onSignOut }: MainCanvasProps) {
  // Backend integration hooks
  const { logout } = useAuth()
  const { isConnected, isReconnecting, signalRService } = useSignalR(config.workspace.defaultWorkspaceId)
  
  // Component state
  const [notes, setNotes] = useState<Note[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [highlightedUsers, setHighlightedUsers] = useState<string[]>([])
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
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
  const [activeCollaborators, setActiveCollaborators] = useState<string[]>([])
  
  // Track user-initiated moves to avoid showing notifications for own actions
  const userInitiatedMoves = useRef<Set<string>>(new Set())

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



  // RAF-based throttled move function for smoother performance
  const rafThrottledMoveNote = useRef(
    rafThrottle((id: string, x: number, y: number) => {
      setNotes(prev => prev.map(note => 
        note.id === id ? { ...note, x, y, lastModified: new Date() } : note
      ))
    })
  ).current



  // Initialize data from backend
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        // Load notes and users in parallel
        const [notesData, usersData] = await Promise.all([
          apiService.getNotes(config.workspace.defaultWorkspaceId),
          apiService.getOnlineUsers()
        ])

        // Convert backend DTOs to frontend models
        const convertedNotes: Note[] = notesData.map(noteDto => ({
          id: noteDto.id,
          content: noteDto.content,
          author: noteDto.authorEmail,
          createdAt: new Date(noteDto.createdAt),
          updatedAt: new Date(noteDto.updatedAt),
          x: noteDto.x,
          y: noteDto.y,
          workspaceId: noteDto.workspaceId,
          version: noteDto.version,
          lastModified: new Date(noteDto.updatedAt),
          collaborators: [noteDto.authorEmail],
          imageUrls: noteDto.imageUrls || [],
          reactions: (noteDto.reactions || [])
        }))

        const convertedUsers: User[] = usersData.map(userDto => ({
          id: userDto.id,
          email: userDto.email,
          displayName: userDto.displayName,
          noteCount: convertedNotes.filter(note => note.author === userDto.email).length,
          isOnline: userDto.isOnline,
          lastSeen: new Date(userDto.lastSeen)
        }))

        // Ensure current user is always included in the users list
        let finalUsers = convertedUsers
        const currentUserExists = convertedUsers.some(user => user.email === currentUser)
        
        if (!currentUserExists) {
          console.log('Adding current user to users list:', currentUser)
          const currentUserNoteCount = convertedNotes.filter(note => note.author === currentUser).length
          const currentUserEntry: User = {
            id: `current-user-${Date.now()}`,
            email: currentUser,
            displayName: currentUser.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            noteCount: currentUserNoteCount,
            isOnline: true, // Assume online since we're loading the app
            lastSeen: new Date()
          }
          finalUsers = [...convertedUsers, currentUserEntry]
        }

        setNotes(convertedNotes)
        setUsers(finalUsers)
        setActiveCollaborators(finalUsers.filter(u => u.isOnline && u.email !== currentUser).map(u => u.email))
        
      } catch (err: any) {
        console.error('Error loading data:', err)
        setError(err.message || 'Failed to load data')
        toast({
          title: "Error",
          description: "Failed to load notes and users. Please refresh the page.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [currentUser, toast])

  // SignalR event handlers
  useEffect(() => {
    if (!signalRService || !isConnected) return

    const handleNoteCreated = (noteDto: NoteDto) => {
      console.log('📝 Received NoteCreated event:', {
        id: noteDto.id,
        content: noteDto.content,
        author: noteDto.authorEmail,
        position: { x: noteDto.x, y: noteDto.y },
        currentUser: currentUser
      })
      
      const newNote: Note = {
        id: noteDto.id,
        content: noteDto.content,
        author: noteDto.authorEmail,
        createdAt: new Date(noteDto.createdAt),
        updatedAt: new Date(noteDto.updatedAt),
        x: noteDto.x,
        y: noteDto.y,
        workspaceId: noteDto.workspaceId,
        version: noteDto.version,
        lastModified: new Date(noteDto.updatedAt),
        collaborators: [noteDto.authorEmail],
        imageUrls: noteDto.imageUrls || [],
        reactions: (noteDto.reactions || []).map(reaction => ({
          ...reaction,
          hasCurrentUser: reaction.users.includes(currentUser)
        }))
      }
      
      console.log('📝 Adding note to local state:', newNote)
      setNotes(prev => [...prev, newNote])
      
      // Only show toast if it's not the current user creating the note
      if (noteDto.authorEmail !== currentUser) {
        toast({
          title: "Note Created",
          description: `${noteDto.authorEmail} created a new note`,
        })
      }
    }

    const handleNoteUpdated = (noteDto: NoteDto) => {
      console.log('📝 Received NoteUpdated event:', noteDto)
      
      setNotes(prev => prev.map(note => 
        note.id === noteDto.id ? {
          ...note,
          content: noteDto.content,
          updatedAt: new Date(noteDto.updatedAt),
          version: noteDto.version,
          lastModified: new Date(noteDto.updatedAt),
          imageUrls: noteDto.imageUrls || [],
          reactions: (noteDto.reactions || []).map(reaction => ({
            ...reaction,
            hasCurrentUser: reaction.users.includes(currentUser)
          }))
        } : note
      ))
    }

    const handleNoteMoved = (noteDto: NoteDto) => {
      console.log('📍 Received NoteMoved event:', {
        noteId: noteDto.id,
        authorEmail: noteDto.authorEmail,
        newPosition: { x: noteDto.x, y: noteDto.y },
        currentUser: currentUser
      })
      
      const isMyNote = noteDto.authorEmail === currentUser
      const previousNote = notes.find(n => n.id === noteDto.id)
      const wasUserInitiated = userInitiatedMoves.current.has(noteDto.id)
      
      console.log('📍 NoteMoved details:', {
        isMyNote,
        previousNote: previousNote ? { id: previousNote.id, x: previousNote.x, y: previousNote.y } : null,
        wasUserInitiated,
        userInitiatedMoves: Array.from(userInitiatedMoves.current)
      })
      
      setNotes(prev => prev.map(note => 
        note.id === noteDto.id ? {
          ...note,
          x: noteDto.x,
          y: noteDto.y,
          updatedAt: new Date(noteDto.updatedAt),
          version: noteDto.version,
          lastModified: new Date(noteDto.updatedAt)
        } : note
      ))

      console.log('✅ Note position updated in local state')

      // Only show toast when someone ELSE moves YOUR note (not when you move your own note)
      if (isMyNote && previousNote && !wasUserInitiated) {
        toast({
          title: "Your note was moved!",
          description: `Someone moved your note to help organize the workspace. 🚀`,
          duration: 3000,
        })
      }
    }

    const handleNoteDeleted = (noteId: string) => {
      setNotes(prev => prev.filter(note => note.id !== noteId))
    }

    const handleUserJoined = (email: string) => {
      console.log('👤 User joined workspace:', email)
      
      // Don't add current user to active collaborators (they're not a collaborator to themselves)
      if (email !== currentUser) {
        setActiveCollaborators(prev => prev.includes(email) ? prev : [...prev, email])
      }
      
      setUsers(prev => {
        const existingUser = prev.find(user => user.email === email)
        if (existingUser) {
          // Update existing user to online
          return prev.map(user => 
            user.email === email ? { ...user, isOnline: true } : user
          )
        } else {
          // Add new user to the list
          const noteCount = notes.filter(note => note.author === email).length
          const newUser: User = {
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            email: email,
            displayName: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            noteCount: noteCount,
            isOnline: true,
            lastSeen: new Date()
          }
          return [...prev, newUser]
        }
      })
      
      // Show toast notification for new user (but not for current user)
      if (email !== currentUser) {
        toast({
          title: "User Joined",
          description: `${email} joined the workspace`,
          duration: 3000,
        })
      }
    }

    const handleUserLeft = (email: string) => {
      setActiveCollaborators(prev => prev.filter(e => e !== email))
      setUsers(prev => prev.map(user => 
        user.email === email ? { ...user, isOnline: false } : user
      ))
    }

    const handleUserSignedOut = (email: string) => {
      console.log('👋 User signed out (removing completely):', email)
      setActiveCollaborators(prev => prev.filter(e => e !== email))
      // Remove user completely from the list (not just mark offline)
      setUsers(prev => prev.filter(user => user.email !== email))
      
      toast({
        title: "User Left",
        description: `${email} left the workspace`,
        duration: 3000,
      })
    }



    const handleReactionAdded = (reactionData: NoteReactionDto) => {
      console.log('🎯 Received ReactionAdded event:', reactionData)
      
      // Update the note with the new reaction
      setNotes(prev => prev.map(note => {
        if (note.id === reactionData.noteId) {
          // Find existing reaction of this type
          const existingReactionIndex = note.reactions.findIndex(r => r.reactionType === reactionData.reactionType)
          
          if (existingReactionIndex >= 0) {
            // Update existing reaction
            const updatedReactions = [...note.reactions]
            const existingReaction = updatedReactions[existingReactionIndex]
            
            // Check if user is already in the list
            if (!existingReaction.users.includes(reactionData.userEmail)) {
              const newUsers = [...existingReaction.users, reactionData.userEmail]
              updatedReactions[existingReactionIndex] = {
                ...existingReaction,
                count: existingReaction.count + 1,
                users: newUsers,
                hasCurrentUser: newUsers.includes(currentUser)
              }
            }
            
            // Update hasCurrentUser for all reactions
            return { 
              ...note, 
              reactions: updatedReactions.map(reaction => ({
                ...reaction,
                hasCurrentUser: reaction.users.includes(currentUser)
              }))
            }
          } else {
            // Add new reaction type
            const newReaction = {
              reactionType: reactionData.reactionType,
              count: 1,
              users: [reactionData.userEmail],
              hasCurrentUser: reactionData.userEmail === currentUser
            }
            
            // Update hasCurrentUser for all reactions when adding new one
            const allReactions = [...note.reactions, newReaction].map(reaction => ({
              ...reaction,
              hasCurrentUser: reaction.users.includes(currentUser)
            }))
            
            return { ...note, reactions: allReactions }
          }
        }
        return note
      }))


    }

    const handleReactionRemoved = (reactionId: string) => {
      console.log('🎯 Received ReactionRemoved event:', reactionId)
      // This would need the full reaction data to properly update the UI
      // For now, we'll handle it in the UserReactionRemoved event
    }

    const handleUserReactionRemoved = (noteId: string, userEmail: string, reactionType: string) => {
      console.log('🎯 Received UserReactionRemoved event:', { noteId, userEmail, reactionType })
      
      // Remove the user's specific reaction from the note
      setNotes(prev => prev.map(note => {
        if (note.id === noteId) {
          const updatedReactions = note.reactions.map(reaction => {
            if (reaction.reactionType === reactionType && reaction.users.includes(userEmail)) {
              const newUsers = reaction.users.filter(u => u !== userEmail)
              return {
                ...reaction,
                count: Math.max(0, reaction.count - 1),
                users: newUsers,
                hasCurrentUser: newUsers.includes(currentUser)
              }
            }
            return {
              ...reaction,
              hasCurrentUser: reaction.users.includes(currentUser)
            }
          }).filter(reaction => reaction.count > 0) // Remove reactions with 0 count
          
          return { ...note, reactions: updatedReactions }
        }
        return note
      }))
    }

    // Set up event listeners
    signalRService.on('NoteCreated', handleNoteCreated)
    signalRService.on('NoteUpdated', handleNoteUpdated)
    signalRService.on('NoteMoved', handleNoteMoved)
    signalRService.on('NoteDeleted', handleNoteDeleted)
    signalRService.on('UserJoined', handleUserJoined)
    signalRService.on('UserLeft', handleUserLeft)
    signalRService.on('UserSignedOut', handleUserSignedOut)
    signalRService.on('ReactionAdded', handleReactionAdded)
    signalRService.on('ReactionRemoved', handleReactionRemoved)
    signalRService.on('UserReactionRemoved', handleUserReactionRemoved)

    return () => {
      signalRService.off('NoteCreated', handleNoteCreated)
      signalRService.off('NoteUpdated', handleNoteUpdated)
      signalRService.off('NoteMoved', handleNoteMoved)
      signalRService.off('NoteDeleted', handleNoteDeleted)
      signalRService.off('UserJoined', handleUserJoined)
      signalRService.off('UserLeft', handleUserLeft)
      signalRService.off('UserSignedOut', handleUserSignedOut)
      signalRService.off('ReactionAdded', handleReactionAdded)
      signalRService.off('ReactionRemoved', handleReactionRemoved)
      signalRService.off('UserReactionRemoved', handleUserReactionRemoved)
    }
  }, [signalRService, isConnected, toast, currentUser, notes])

  // Handle reconnection scenarios (page reload, network issues)
  useEffect(() => {
    if (!signalRService) return

    const handleReconnected = async () => {
      console.log('🔄 SignalR reconnected, refreshing data...')
      
      try {
        // Reload notes and users after reconnection
        const [notesData, usersData] = await Promise.all([
          apiService.getNotes(config.workspace.defaultWorkspaceId),
          apiService.getOnlineUsers()
        ])

        // Convert and update state
        const convertedNotes: Note[] = notesData.map(noteDto => ({
          id: noteDto.id,
          content: noteDto.content,
          author: noteDto.authorEmail,
          createdAt: new Date(noteDto.createdAt),
          updatedAt: new Date(noteDto.updatedAt),
          x: noteDto.x,
          y: noteDto.y,
          workspaceId: noteDto.workspaceId,
          version: noteDto.version,
          lastModified: new Date(noteDto.updatedAt),
          collaborators: [noteDto.authorEmail],
          imageUrls: noteDto.imageUrls || [],
          reactions: (noteDto.reactions || []).map(reaction => ({
            ...reaction,
            hasCurrentUser: reaction.users.includes(currentUser)
          }))
        }))

        const convertedUsers: User[] = usersData.map(userDto => ({
          id: userDto.id,
          email: userDto.email,
          displayName: userDto.displayName,
          noteCount: convertedNotes.filter(note => note.author === userDto.email).length,
          isOnline: userDto.isOnline,
          lastSeen: new Date(userDto.lastSeen)
        }))

        // Ensure current user is always included in the users list
        let finalUsers = convertedUsers
        const currentUserExists = convertedUsers.some(user => user.email === currentUser)
        
        if (!currentUserExists) {
          console.log('Adding current user to users list after reconnection:', currentUser)
          const currentUserNoteCount = convertedNotes.filter(note => note.author === currentUser).length
          const currentUserEntry: User = {
            id: `current-user-${Date.now()}`,
            email: currentUser,
            displayName: currentUser.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            noteCount: currentUserNoteCount,
            isOnline: true, // Assume online since we're reconnecting
            lastSeen: new Date()
          }
          finalUsers = [...convertedUsers, currentUserEntry]
        }

        setNotes(convertedNotes)
        setUsers(finalUsers)
        setActiveCollaborators(finalUsers.filter(u => u.isOnline && u.email !== currentUser).map(u => u.email))
        
        toast({
          title: "Reconnected",
          description: "Real-time collaboration restored",
        })
        
        console.log('✅ Data refreshed after reconnection')
      } catch (error) {
        console.error('❌ Failed to refresh data after reconnection:', error)
        toast({
          title: "Reconnection Issue",
          description: "Please refresh the page if issues persist",
          variant: "destructive",
        })
      }
    }

    // Listen for reconnection events
    signalRService.on('Reconnected', handleReconnected)

    return () => {
      signalRService.off('Reconnected', handleReconnected)
    }
  }, [signalRService, currentUser, toast])

  // Update user note counts when notes change
  useEffect(() => {
    if (users.length > 0) {
      setUsers(prevUsers => {
        // Create a map of current users for quick lookup
        const currentUsersMap = new Map(prevUsers.map(user => [user.email, user]))
        
        // Get all unique authors from notes
        const allAuthors = new Set(notes.map(note => note.author))
        
        // Update existing users and add any missing authors
        const updatedUsers = Array.from(allAuthors).map(authorEmail => {
          const existingUser = currentUsersMap.get(authorEmail)
          const noteCount = notes.filter(note => note.author === authorEmail).length
          
          if (existingUser) {
            // Update existing user's note count
            return {
              ...existingUser,
              noteCount
            }
          } else {
            // Create new user entry for authors not in the users list
            return {
              id: `temp-${authorEmail}`,
              email: authorEmail,
              displayName: authorEmail.split('@')[0],
              noteCount,
              isOnline: activeCollaborators.includes(authorEmail),
              lastSeen: new Date(),
              cursor: undefined
            }
          }
        })
        
        // Also include users who have no notes (preserve users without notes)
        const authorsWithNotes = new Set(notes.map(note => note.author))
        const usersWithoutNotes = prevUsers.filter(user => !authorsWithNotes.has(user.email))
          .map(user => ({ ...user, noteCount: 0 }))
        
        // Combine users with notes and users without notes
        return [...updatedUsers, ...usersWithoutNotes]
      })
    }
  }, [notes, activeCollaborators]) // Fixed: removed users.length, added activeCollaborators

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
    if (canvas.isPanning) {
      const deltaX = clientX - canvas.panStart.x
      const deltaY = clientY - canvas.panStart.y

      setCanvas(prev => ({
        ...prev,
        offset: {
          x: prev.lastOffset.x + deltaX,
          y: prev.lastOffset.y + deltaY
        }
      }))
    }
  }, [canvas.isPanning, canvas.panStart, canvas.lastOffset, canvas.offset, canvas.scale])

  const handleCanvasEnd = useCallback(() => {
    setCanvas(prev => ({ ...prev, isPanning: false }))
  }, [])

  // Canvas event handlers - FIXED VERSION
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Allow dragging when clicking on canvas or its direct children (like the grid)
    const target = e.target as HTMLElement
    const canvasElement = canvasRef.current
    
    // Check if we're clicking on the canvas or its direct children (grid, empty areas)
    if (target === canvasElement || 
        target.closest('[data-canvas="true"]') === canvasElement ||
        (target.classList.contains('absolute') && target.parentElement === canvasElement)) {
      e.preventDefault()
      e.stopPropagation()
      console.log('Mouse down on canvas area') // Debug log
      handleCanvasStart(e.clientX, e.clientY)
    }
  }

  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    // Allow dragging when touching on canvas or its direct children
    const target = e.target as HTMLElement
    const canvasElement = canvasRef.current
    
    if (target === canvasElement || 
        target.closest('[data-canvas="true"]') === canvasElement ||
        (target.classList.contains('absolute') && target.parentElement === canvasElement)) {
      if (e.touches.length === 1) {
        // Single touch - pan canvas
        e.preventDefault()
        const touch = e.touches[0]
        console.log('Touch start on canvas area') // Debug log
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
    console.log('🎯 Centering canvas on notes...')
    if (notes.length === 0) {
      console.log('❌ No notes to center on')
      toast({
        title: "No Notes Found",
        description: "Create some notes first to center the view.",
        duration: 2000,
      })
      return
    }
    
    console.log('📊 Calculating bounds for', notes.length, 'notes')
    const bounds = notes.reduce((acc, note) => ({
      minX: Math.min(acc.minX, note.x),
      maxX: Math.max(acc.maxX, note.x + 256), // Note width
      minY: Math.min(acc.minY, note.y),
      maxY: Math.max(acc.maxY, note.y + 128)  // Note height
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })

    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    
    console.log('📐 Notes bounds:', bounds)
    console.log('📍 Center point:', { centerX, centerY })
    
    const container = containerRef.current
    if (container) {
      const containerRect = container.getBoundingClientRect()
      const newOffset = {
        x: containerRect.width / 2 - centerX * canvas.scale,
        y: containerRect.height / 2 - centerY * canvas.scale
      }
      
      console.log('🚀 Setting new canvas offset:', newOffset)
      setCanvas(prev => ({
        ...prev,
        offset: newOffset,
        isPanning: false // Ensure smooth transition
      }))
      
      toast({
        title: "Centered on Notes",
        description: `Focused on ${notes.length} note${notes.length !== 1 ? 's' : ''}`,
        duration: 2000,
      })
    } else {
      console.error('❌ Container ref not available')
    }
  }

  // Add wheel event listener for zoom functionality
  useEffect(() => {
    const containerElement = containerRef.current
    if (!containerElement) return

    const handleWheelEvent = (e: WheelEvent) => {
      // Only prevent default and handle zoom if Ctrl/Cmd is pressed OR if it's a trackpad pinch
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 50) {
        e.preventDefault()
        e.stopPropagation()
        
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
        const containerRect = containerElement.getBoundingClientRect()
        
        // Calculate zoom center relative to container
        const centerX = e.clientX - containerRect.left
        const centerY = e.clientY - containerRect.top
        handleZoom(delta, centerX, centerY)
      }
    }

    // Add non-passive wheel event listener
    containerElement.addEventListener('wheel', handleWheelEvent, { passive: false })

    return () => {
      containerElement.removeEventListener('wheel', handleWheelEvent)
    }
  }, [handleZoom])

  // Cross-platform keyboard shortcuts
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in inputs/textareas
      const activeElement = document.activeElement
      const isEditing = activeElement?.tagName === 'INPUT' || 
                       activeElement?.tagName === 'TEXTAREA' || 
                       (activeElement as HTMLElement)?.contentEditable === 'true'

      // Skip keyboard shortcuts when editing (but allow on mobile for space key)
      if (isEditing) return

      // Cross-platform modifier key (Cmd on Mac, Ctrl on Windows/Linux)
      const isModifierPressed = e.metaKey || e.ctrlKey

      // Create Note: Space (works on both desktop and mobile when not editing)
      if (!isEditing && !isModifierPressed && e.key === ' ') {
        e.preventDefault()
        console.log('Space key pressed - creating note')
        createNote()
        return
      }

      // Skip other shortcuts on mobile devices (except space key above)
      if (isMobile) return

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

    document.addEventListener('keydown', handleKeyboardShortcuts)

    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts)
    }
      }, [canvas.scale, isMobile, notes.length, canvas])

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
  const createNote = async () => {
    console.log('createNote function called')
    const container = containerRef.current
    if (!container) {
      console.error('Container ref not available')
      return
    }

    const containerRect = container.getBoundingClientRect()
    const centerX = containerRect.width / 2
    const centerY = containerRect.height / 2

    // Convert viewport center to canvas coordinates
    const canvasX = (centerX - canvas.offset.x) / canvas.scale
    const canvasY = (centerY - canvas.offset.y) / canvas.scale

    const noteData: NoteCreateDto = {
      content: "New note", // Default content to prevent empty notes
      x: canvasX - 128, // Center the note
      y: canvasY - 64,
      workspaceId: config.workspace.defaultWorkspaceId
    }
    
    console.log('🚀 Creating note with data:', noteData)
    console.log('📡 SignalR connected:', isConnected, 'Service available:', !!signalRService)
    
    try {
      // Create note via SignalR for real-time collaboration
      if (signalRService && isConnected) {
        console.log('Creating note via SignalR')
        await signalRService.createNote(config.workspace.defaultWorkspaceId, noteData)
        console.log('Note created via SignalR successfully')
      } else {
        console.log('Creating note via API fallback (SignalR not available)')
        // Fallback to direct API call
        const createdNote = await apiService.createNote(config.workspace.defaultWorkspaceId, noteData)
        console.log('Note created via API:', createdNote)
        const newNote: Note = {
          id: createdNote.id,
          content: createdNote.content,
          author: createdNote.authorEmail,
          createdAt: new Date(createdNote.createdAt),
          updatedAt: new Date(createdNote.updatedAt),
          x: createdNote.x,
          y: createdNote.y,
          workspaceId: createdNote.workspaceId,
          version: createdNote.version,
          lastModified: new Date(createdNote.updatedAt),
          collaborators: [createdNote.authorEmail],
          imageUrls: createdNote.imageUrls || [],
          reactions: createdNote.reactions || []
        }
        setNotes((prev) => [...prev, newNote])
        console.log('Note added to local state')
        
        // Show success toast for API fallback
        toast({
          title: "Note Created",
          description: "New note created successfully",
        })
      }
    } catch (error: any) {
      console.error('Error creating note:', error)
      
      // Check for empty content validation error
      if (error.message?.includes('content cannot be empty') || error.message?.includes('cannot be empty')) {
        toast({
          title: "Cannot Create Empty Note",
          description: "Please add some content to create a note.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create note. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  // Enhanced SignalR connection monitoring with debug logging
  useEffect(() => {
    console.log('🔍 SignalR Connection Monitor - Setting up...')
    console.log('📊 Current state:', { isConnected, isReconnecting, signalRService: !!signalRService })
    
    // Log connection state changes
    const logConnectionState = () => {
      const state = signalRService?.getState()
      console.log('📡 SignalR State Update:', {
        isConnected: state?.isConnected,
        connectionId: state?.connectionId,
        isReconnecting: state?.isReconnecting,
        lastError: state?.lastError
      })
    }

    // Set up enhanced event listeners with debug logging
    const handleConnected = () => {
      console.log('✅ SignalR Connected - Setting up workspace join...')
      logConnectionState()
    }

    const handleDisconnected = (error?: string) => {
      console.log('❌ SignalR Disconnected:', error)
      logConnectionState()
    }

    const handleReconnecting = (error?: string) => {
      console.log('🔄 SignalR Reconnecting:', error)
      logConnectionState()
    }

    const handleReconnected = (connectionId?: string) => {
      console.log('✅ SignalR Reconnected:', connectionId)
      logConnectionState()
    }

    const handleError = (error: string) => {
      console.error('❌ SignalR Error:', error)
      logConnectionState()
    }

    if (signalRService) {
      signalRService.on('Connected', handleConnected)
      signalRService.on('Disconnected', handleDisconnected)
      signalRService.on('Reconnecting', handleReconnecting)
      signalRService.on('Reconnected', handleReconnected)
      signalRService.on('Error', handleError)

      // Log current state
      logConnectionState()
    }

    return () => {
      if (signalRService) {
        signalRService.off('Connected', handleConnected)
        signalRService.off('Disconnected', handleDisconnected)
        signalRService.off('Reconnecting', handleReconnecting)
        signalRService.off('Reconnected', handleReconnected)
        signalRService.off('Error', handleError)
      }
    }
  }, [signalRService, isConnected, isReconnecting])

  // Enhanced move note with better error handling and logging
  const moveNote = useCallback(async (id: string, x: number, y: number) => {
    console.log('🚀 moveNote called:', { id, x, y, isConnected, signalRService: !!signalRService })
    
    const currentNote = notes.find(n => n.id === id)
    if (!currentNote) {
      console.error('❌ Note not found for move:', id)
      return
    }

    // Mark as user-initiated move to prevent feedback loops
    userInitiatedMoves.current.add(id)
    setTimeout(() => userInitiatedMoves.current.delete(id), 1000)

    // Update local state immediately for responsive UI
    rafThrottledMoveNote(id, x, y)
    
    try {
      // Send update to backend via SignalR or API
      if (signalRService && isConnected) {
        console.log('📡 Sending move via SignalR...')
        await signalRService.moveNote(id, x, y)
        console.log('✅ Move sent via SignalR successfully')
      } else {
        console.log('🔄 Sending move via API fallback (SignalR not available)')
        console.log('SignalR state:', { 
          service: !!signalRService, 
          connected: isConnected,
          state: signalRService?.getState()
        })
        await apiService.moveNote(id, { id, x, y })
        console.log('✅ Move sent via API successfully')
      }

      // No toast notifications for moving notes - notifications only when others move your notes
    } catch (error: any) {
      console.error('❌ Error moving note:', error)
      
      // Check if it's a version conflict
      if (error.message?.includes('modified by another user')) {
        toast({
          title: "Version Conflict",
          description: "This note was updated by another user. The page will refresh to get the latest version.",
          variant: "destructive",
        })
        // Refresh the notes to get the latest version
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        toast({
          title: "Error",
          description: "Failed to move note. Please try again.",
          variant: "destructive",
        })
        // Revert local change on error
        setNotes(prev => prev.map(n => n.id === id ? { ...n, x: currentNote.x, y: currentNote.y } : n))
      }
    }
  }, [rafThrottledMoveNote, signalRService, isConnected, notes, toast, currentUser])

  // Enhanced note update with better error handling and logging
  const updateNote = useCallback(async (id: string, content: string) => {
    console.log('🚀 updateNote called for note:', id, 'content:', content)
    console.log('📊 SignalR state:', { isConnected, service: !!signalRService })
    
    // Get the current note with latest version
    const currentNote = notes.find(n => n.id === id)
    if (!currentNote) {
      console.error('❌ Current note not found for ID:', id)
      return
    }

    console.log('✅ Current note found:', currentNote)

    // Update local state immediately for responsive UI
    setNotes(prev => prev.map(note => 
      note.id === id 
        ? { ...note, content, lastModified: new Date() }
        : note
    ))

    try {
      const updateData: NoteUpdateDto = {
        content,
        version: currentNote.version // Use current version for concurrency control
      }

      console.log('📝 Update data:', updateData)

      // Send update to backend via SignalR or API
      if (signalRService && isConnected) {
        console.log('📡 Updating note via SignalR')
        await signalRService.updateNote(id, updateData)
        console.log('✅ Note updated via SignalR successfully')
      } else {
        console.log('🔄 Updating note via API fallback (SignalR not available)')
        console.log('SignalR state:', { 
          service: !!signalRService, 
          connected: isConnected,
          state: signalRService?.getState()
        })
        await apiService.updateNote(id, updateData)
        console.log('✅ Note updated via API successfully')
      }
    } catch (error: any) {
      console.error('❌ Error updating note:', error)
      
      // Check if it's a version conflict
      if (error.message?.includes('modified by another user')) {
        toast({
          title: "Version Conflict",
          description: "This note was updated by another user. The page will refresh to get the latest version.",
          variant: "destructive",
        })
        // Refresh the notes to get the latest version
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        toast({
          title: "Error",
          description: "Failed to update note. Please try again.",
          variant: "destructive",
        })
        // Revert local change on error
        setNotes(prev => prev.map(n => n.id === id ? currentNote : n))
      }
    }
  }, [notes, signalRService, isConnected, toast])

  // Optimized note deletion with backend integration
  const deleteNote = useCallback(async (id: string) => {
    const currentNote = notes.find(n => n.id === id)
    if (!currentNote) return

    // Update local state immediately for responsive UI
    setNotes(prev => prev.filter(note => note.id !== id))

    try {
      // Send delete to backend via SignalR or API
      if (signalRService && isConnected) {
        await signalRService.deleteNote(id)
      } else {
        await apiService.deleteNote(id)
      }
    } catch (error: any) {
      console.error('Error deleting note:', error)
      
      // Check if it's a version conflict
      if (error.message?.includes('modified by another user')) {
        toast({
          title: "Version Conflict",
          description: "This note was updated by another user. The page will refresh to get the latest version.",
          variant: "destructive",
        })
        // Refresh the notes to get the latest version
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        toast({
          title: "Error",
          description: "Failed to delete note. Please try again.",
          variant: "destructive",
        })
        // Revert local change on error
        setNotes(prev => [...prev, currentNote])
      }
    }
  }, [notes, signalRService, isConnected, toast])

  // Image upload handler
  const handleImageUpload = useCallback(async (noteId: string, file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${config.api.baseUrl}/api/notes/${noteId}/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem(config.auth.tokenKey)}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload image')
      }

      const result = await response.json()
      
             // Refresh the notes to show the new image
       const updatedNotesData = await apiService.getNotes(config.workspace.defaultWorkspaceId)
       const updatedNotes: Note[] = updatedNotesData.map(noteDto => ({
         id: noteDto.id,
         content: noteDto.content,
         author: noteDto.authorEmail,
         createdAt: new Date(noteDto.createdAt),
         updatedAt: new Date(noteDto.updatedAt),
         x: noteDto.x,
         y: noteDto.y,
         workspaceId: noteDto.workspaceId,
         version: noteDto.version,
         lastModified: new Date(noteDto.updatedAt),
         collaborators: [noteDto.authorEmail],
         imageUrls: noteDto.imageUrls || [],
         reactions: [] // Add missing reactions property
       }))
       setNotes(updatedNotes)
      
      toast({
        title: "Image uploaded successfully",
        description: "Your image has been added to the note.",
        duration: 3000,
      })
    } catch (error: any) {
      console.error('Error uploading image:', error)
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image. Please try again.",
        variant: "destructive",
      })
    }
  }, [toast, currentUser])

  // Image delete handler
  const handleImageDelete = useCallback(async (noteId: string, imageUrl: string) => {
    try {
      console.log('🗑️ Deleting image:', { noteId, imageUrl })
      
      // Send delete via SignalR if available
      if (signalRService && isConnected) {
        console.log('📡 Deleting image via SignalR')
        // TODO: Add SignalR method for image deletion when backend supports it
        // await signalRService.deleteImage(noteId, imageUrl)
        
        // For now, use API call and then refresh
        const response = await fetch(`${config.api.baseUrl}/api/notes/${noteId}/images`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem(config.auth.tokenKey)}`
          },
          body: JSON.stringify({ imageUrl })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to delete image')
        }
        
        // Refresh the note data to get updated images
        const updatedNotesData = await apiService.getNotes(config.workspace.defaultWorkspaceId)
        const updatedNotes: Note[] = updatedNotesData.map(noteDto => ({
          id: noteDto.id,
          content: noteDto.content,
          author: noteDto.authorEmail,
          createdAt: new Date(noteDto.createdAt),
          updatedAt: new Date(noteDto.updatedAt),
          x: noteDto.x,
          y: noteDto.y,
          workspaceId: noteDto.workspaceId,
          version: noteDto.version,
          lastModified: new Date(noteDto.updatedAt),
          collaborators: [noteDto.authorEmail],
          imageUrls: noteDto.imageUrls || [],
          reactions: (noteDto.reactions || []).map(reaction => ({
            ...reaction,
            hasCurrentUser: reaction.users.includes(currentUser)
          }))
        }))
        setNotes(updatedNotes)
        
        console.log('✅ Image deleted and notes refreshed')
      } else {
        console.log('🔄 Deleting image via API fallback (SignalR not available)')
        
        const response = await fetch(`${config.api.baseUrl}/api/notes/${noteId}/images`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem(config.auth.tokenKey)}`
          },
          body: JSON.stringify({ imageUrl })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to delete image')
        }
        
        // Update local state immediately by removing the image from the note
        setNotes(prev => prev.map(note => 
          note.id === noteId 
            ? { 
                ...note, 
                imageUrls: note.imageUrls.filter(url => url !== imageUrl),
                lastModified: new Date()
              }
            : note
        ))
        
        console.log('✅ Image deleted via API successfully')
      }
      
      toast({
        title: "Image deleted",
        description: "The image has been removed from the note.",
        duration: 2000,
      })
      
    } catch (error: any) {
      console.error('❌ Error deleting image:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete image. Please try again.",
        variant: "destructive",
      })
    }
  }, [signalRService, isConnected, toast, currentUser])

  // Enhanced reaction handlers with better logging
  const handleAddReaction = useCallback(async (noteId: string, reactionType: string) => {
    console.log('🚀 handleAddReaction called:', { noteId, reactionType, isConnected, service: !!signalRService })
    
    try {
      // Send reaction via SignalR if available
      if (signalRService && isConnected) {
        console.log('📡 Adding reaction via SignalR')
        await signalRService.addReaction(config.workspace.defaultWorkspaceId, {
          noteId,
          reactionType
        })
        console.log('✅ Reaction added via SignalR successfully')
      } else {
        console.log('🔄 Adding reaction via API fallback (SignalR not available)')
        console.log('SignalR state:', { 
          service: !!signalRService, 
          connected: isConnected,
          state: signalRService?.getState()
        })
        
        // Fallback to direct API call
        const response = await fetch(`${config.api.baseUrl}/api/notes/${noteId}/reactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem(config.auth.tokenKey)}`
          },
          body: JSON.stringify({ reactionType })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to add reaction')
        }
        console.log('✅ Reaction added via API successfully')
      }
    } catch (error: any) {
      console.error('❌ Error adding reaction:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to add reaction. Please try again.",
        variant: "destructive",
      })
    }
  }, [signalRService, isConnected, toast])

  const handleRemoveReaction = useCallback(async (noteId: string, reactionType: string) => {
    console.log('🚀 handleRemoveReaction called:', { noteId, reactionType, isConnected, service: !!signalRService })
    
    try {
      // Send reaction removal via SignalR if available
      if (signalRService && isConnected) {
        console.log('📡 Removing reaction via SignalR')
        await signalRService.removeUserReaction(config.workspace.defaultWorkspaceId, noteId, reactionType)
        console.log('✅ Reaction removed via SignalR successfully')
      } else {
        console.log('🔄 Removing reaction via API fallback (SignalR not available)')
        console.log('SignalR state:', { 
          service: !!signalRService, 
          connected: isConnected,
          state: signalRService?.getState()
        })
        
        // Fallback to direct API call
        const response = await fetch(`${config.api.baseUrl}/api/notes/${noteId}/reactions?reactionType=${encodeURIComponent(reactionType)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem(config.auth.tokenKey)}`
          }
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to remove reaction')
        }
        console.log('✅ Reaction removed via API successfully')
      }
    } catch (error: any) {
      console.error('❌ Error removing reaction:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove reaction. Please try again.",
        variant: "destructive",
      })
    }
  }, [signalRService, isConnected, toast])

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
    handleSignOut()
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

  // Handle sign out
  const handleSignOut = async () => {
    console.log('🔐 Starting sign out process...')
    try {
      // Step 1: Sign out from workspace via SignalR (this will remove user completely)
      if (signalRService && isConnected) {
        console.log('📡 Signing out from workspace via SignalR...')
        await signalRService.signOut(config.workspace.defaultWorkspaceId)
      }
      
      // Step 2: Disconnect SignalR
      if (signalRService) {
        console.log('🔌 Disconnecting SignalR...')
        await signalRService.disconnect()
      }
      
      // Step 3: Logout from backend
      console.log('🚪 Logging out from backend...')
      await logout()
      
      // Step 4: Call parent callback
      console.log('✅ Sign out completed successfully')
      onSignOut()
    } catch (error) {
      console.error('❌ Error during sign out:', error)
      // Force logout even if there's an error
      onSignOut()
    }
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading notes...</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex">
        {/* Error Alert */}
        {error && (
          <div className="fixed top-4 right-4 z-50 w-96">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

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

        {/* Debug Panel - Only in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-4 right-4 z-50 bg-background/90 backdrop-blur border rounded-lg p-3 text-xs space-y-2 max-w-xs">
            <div className="font-semibold">SignalR Debug</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Connected:</span>
                <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
                  {isConnected ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Reconnecting:</span>
                <span className={isReconnecting ? 'text-orange-600' : 'text-gray-600'}>
                  {isReconnecting ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Service:</span>
                <span className={signalRService ? 'text-green-600' : 'text-red-600'}>
                  {signalRService ? 'Available' : 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Connection ID:</span>
                <span className="text-xs truncate max-w-20" title={signalRService?.getState()?.connectionId || 'None'}>
                  {signalRService?.getState()?.connectionId?.substring(0, 8) || 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Workspace:</span>
                <span className="text-xs truncate max-w-20" title={signalRService?.getCurrentWorkspace() || 'None'}>
                  {signalRService?.getCurrentWorkspace() || 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Notes:</span>
                <span>{notes.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Users:</span>
                <span>{users.length}</span>
              </div>
            </div>
            <div className="pt-2 border-t space-y-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => signalRService?.forceReconnect()}
                className="w-full text-xs h-7"
              >
                Force Reconnect
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const firstNote = notes[0]
                  if (firstNote) {
                    const newX = firstNote.x + 50
                    const newY = firstNote.y + 50
                    console.log('🧪 Testing note move:', { noteId: firstNote.id, newX, newY })
                    moveNote(firstNote.id, newX, newY)
                  } else {
                    console.log('❌ No notes available for testing')
                  }
                }}
                className="w-full text-xs h-7"
              >
                Test Move Note
              </Button>
            </div>
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
                      <SheetTitle className="sr-only">Group Members</SheetTitle>
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
                  <div className="flex items-center gap-1.5 text-xs">
                    {isConnected ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-green-600 dark:text-green-400">Online</span>
                      </>
                    ) : isReconnecting ? (
                      <>
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                        <span className="text-orange-600 dark:text-orange-400">Reconnecting...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-red-600 dark:text-red-400">Offline</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{activeCollaborators.length + 1} active</span>
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
                  canDrag={true} // Allow all users to drag all notes for better collaboration
                  userColor={getUserColor(note.author, false)}
                  onUpdate={updateNote}
                  onDelete={deleteNote}
                  onMove={moveNote}
                  onImageUpload={handleImageUpload}
                  onImageDelete={handleImageDelete}
                  onAddReaction={handleAddReaction}
                  onRemoveReaction={handleRemoveReaction}
                />
              ))}


            </div>

            {/* Canvas Controls - Always visible and properly positioned */}
            {/* Always use mobile-style centered toolbar */}
            <div className="fixed bottom-4 left-4 right-4 flex justify-center z-30">
              <div className="flex gap-2 bg-background/95 backdrop-blur border rounded-full px-4 py-2 shadow-lg">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={createNote}
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add Note {!isMobile && "(Space)"}</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={zoomOut}
                      disabled={canvas.scale <= MIN_ZOOM}
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom Out {!isMobile && "(Ctrl/⌘ + -)"}</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={zoomIn}
                      disabled={canvas.scale >= MAX_ZOOM}
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom In {!isMobile && "(Ctrl/⌘ + +)"}</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                                      <Button variant="outline" size="sm" onClick={resetCanvas} className="h-10 w-10 rounded-full flex items-center justify-center">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reset View {!isMobile && "(Ctrl/⌘ + 0)"}</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                                      <Button variant="outline" size="sm" onClick={centerCanvas} className="h-10 w-10 rounded-full flex items-center justify-center">
                    <Navigation className="w-4 h-4" />
                  </Button>
                  </TooltipTrigger>
                  <TooltipContent>Center on Notes {!isMobile && "(Ctrl/⌘ + H)"}</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsFocusMode(!isFocusMode)}
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                    >
                      {isFocusMode ? (
                        <Minimize2 className="w-4 h-4" />
                      ) : (
                        <Maximize2 className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'} {!isMobile && "(M)"}
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Keyboard Shortcuts {!isMobile && "(?)"}</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Focus Mode - UI elements are conditionally hidden */}
          </div>
        </div>
        
        {/* Keyboard Shortcuts Help */}
        <KeyboardHelp />
      </div>
    </TooltipProvider>
  )
}


