"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, Eye, Check } from "lucide-react"
import { memo, useMemo, useCallback } from "react"
import { FixedSizeList as List } from "react-window"
import { getDisplayName } from "@/lib/performance"

interface User {
  email: string
  noteCount: number
  isOnline: boolean
}

interface UserSidebarProps {
  users: User[]
  currentUser: string
  highlightedUsers: string[]
  onUserClick: (userEmail: string) => void
  getUserColor: (email: string) => { bg: string; text: string; border: string; ring: string; accent: string; accentLight: string }
}

const UserItem = memo(({ index, style, data }: { index: number; style: any; data: any }) => {
  const { users, currentUser, highlightedUsers, onUserClick, getUserColor } = data
  const user = users[index]
  const isHighlighted = highlightedUsers.includes(user.email)
  const isCurrentUser = user.email === currentUser
  const userColor = getUserColor(user.email)
  const displayName = getDisplayName(user.email)

  const handleClick = useCallback(() => {
    onUserClick(user.email)
  }, [user.email, onUserClick])

  return (
    <div style={style} className="px-3 sm:px-4">
      <Button
        variant="ghost"
        className={`w-full justify-start h-auto p-3 min-h-[56px] transition-all duration-200 rounded-lg ${
          isHighlighted 
            ? 'bg-primary/10 ring-2 ring-primary/30 shadow-sm' 
            : 'hover:bg-muted/50'
        } ${isCurrentUser ? 'bg-muted/30' : ''}`}
        onClick={handleClick}
      >
        <div className="flex items-center gap-3 w-full">
          {/* User Avatar */}
          <div className="relative">
            <div className={`w-9 h-9 ${userColor.bg} rounded-full flex items-center justify-center transition-all duration-200 ${
              isHighlighted ? 'ring-2 ring-offset-2 ring-primary scale-105' : ''
            }`}>
              {isHighlighted ? (
                <Check className="w-5 h-5 text-white" />
              ) : (
                <span className={`text-sm font-semibold ${userColor.text}`}>
                  {displayName[0].toUpperCase()}
                </span>
              )}
            </div>
            
            {/* Online Status Indicator */}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
              user.isOnline ? "bg-green-500" : "bg-gray-400"
            }`} />
          </div>
          
          {/* User Info */}
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium truncate ${
                isHighlighted ? 'text-primary font-semibold' : 'text-foreground'
              }`}>
                {displayName}
                {isCurrentUser && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">(You)</span>
                )}
              </span>
              
              {/* Highlighted indicator */}
              {isHighlighted && (
                <div className="flex items-center gap-1">
                  <Eye className="w-3 h-3 text-primary" />
                  <span className="text-xs font-medium text-primary">viewing</span>
                </div>
              )}
            </div>
            
            {/* Note count and status */}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={isHighlighted ? "default" : "secondary"} className="text-xs">
                {user.noteCount} {user.noteCount === 1 ? 'note' : 'notes'}
              </Badge>
              
              {!user.isOnline && (
                <span className="text-xs text-muted-foreground">offline</span>
              )}
            </div>
          </div>
        </div>
      </Button>
    </div>
  )
})

UserItem.displayName = "UserItem"

const UserSidebar = memo(({ users, currentUser, highlightedUsers, onUserClick, getUserColor }: UserSidebarProps) => {
  // Sort users to put current user at top, then online users, then offline users
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      // Current user always first
      if (a.email === currentUser) return -1
      if (b.email === currentUser) return 1
      
      // Then sort by online status
      if (a.isOnline && !b.isOnline) return -1
      if (!a.isOnline && b.isOnline) return 1
      
      // Finally sort alphabetically by display name
      const aName = getDisplayName(a.email)
      const bName = getDisplayName(b.email)
      return aName.localeCompare(bName)
    })
  }, [users, currentUser])

  const onlineUsersCount = useMemo(() => {
    return users.filter(u => u.isOnline).length
  }, [users])

  const clearAllHighlights = useCallback(() => {
    highlightedUsers.forEach(email => onUserClick(email))
  }, [highlightedUsers, onUserClick])

  const itemData = useMemo(() => ({
    users: sortedUsers,
    currentUser,
    highlightedUsers,
    onUserClick,
    getUserColor
  }), [sortedUsers, currentUser, highlightedUsers, onUserClick, getUserColor])

  // Calculate the height dynamically based on window height
  const listHeight = useMemo(() => {
    if (typeof window !== 'undefined') {
      return window.innerHeight - 200 // Adjust based on header/footer height
    }
    return 600 // Default height for SSR
  }, [])

  return (
    <div className="w-full lg:w-64 border-r bg-muted/10 flex flex-col h-screen">
      <div className="p-3 sm:p-4 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          <h2 className="font-semibold text-sm sm:text-base">Group Members</h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">{onlineUsersCount} online</p>
      </div>

             <div className="flex-1 min-h-0">
         <List
           height={listHeight}
           width="100%"
           itemCount={sortedUsers.length}
           itemSize={72} // Height of each user item
           itemData={itemData}
           overscanCount={5} // Render 5 extra items for smooth scrolling
         >
           {UserItem}
         </List>
       </div>

      <div className="p-3 sm:p-4 border-t space-y-2 flex-shrink-0">
        <div className="text-xs text-muted-foreground">
          {highlightedUsers.length === 0 
            ? "Click users to view only their notes" 
            : `Viewing notes from ${highlightedUsers.length} user${highlightedUsers.length > 1 ? 's' : ''}`
          }
        </div>
        {highlightedUsers.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearAllHighlights}
            className="w-full text-xs"
          >
            View All Notes
          </Button>
        )}
      </div>
    </div>
  )
})

UserSidebar.displayName = "UserSidebar"

export { UserSidebar }
