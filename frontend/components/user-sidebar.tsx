"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, Circle, Eye, Check } from "lucide-react"
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
  const userColor = getUserColor(user.email)
  const displayName = getDisplayName(user.email)

  const handleClick = useCallback(() => {
    onUserClick(user.email)
  }, [user.email, onUserClick])

  return (
    <div style={style} className="px-3 sm:px-4">
      <Button
        variant="ghost"
        className={`w-full justify-start h-auto p-2 sm:p-3 min-h-[48px] transition-all duration-200 ${
          isHighlighted 
            ? 'bg-muted/50 ring-1 ring-primary/20' 
            : 'hover:bg-muted/30'
        }`}
        onClick={handleClick}
      >
        <div className="flex items-center gap-2 sm:gap-3 w-full">
          <div className="relative">
            <div className={`w-7 h-7 sm:w-8 sm:h-8 ${userColor.bg} rounded-full flex items-center justify-center ${
              isHighlighted ? 'ring-2 ring-offset-1 ring-primary' : ''
            }`}>
              {isHighlighted ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <span className={`text-xs sm:text-sm font-medium ${userColor.text}`}>
                  {displayName[0].toUpperCase()}
                </span>
              )}
            </div>
            <Circle
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 ${
                user.isOnline ? "text-green-500 fill-green-500" : "text-gray-400 fill-gray-400"
              }`}
            />
          </div>
          
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-medium truncate">
                {displayName}
                {user.email === currentUser && " (You)"}
              </span>
              {isHighlighted && (
                <Eye className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {user.noteCount} notes
              </Badge>
              {!user.isOnline && <span className="text-xs text-muted-foreground">offline</span>}
              {isHighlighted && (
                <span className="text-xs text-muted-foreground font-medium">highlighted</span>
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
           itemSize={60} // Height of each user item
           itemData={itemData}
           overscanCount={5} // Render 5 extra items for smooth scrolling
         >
           {UserItem}
         </List>
       </div>

      <div className="p-3 sm:p-4 border-t space-y-2 flex-shrink-0">
        <div className="text-xs text-muted-foreground">
          {highlightedUsers.length === 0 
            ? "Tap users to highlight their notes (multi-select)" 
            : `${highlightedUsers.length} user${highlightedUsers.length > 1 ? 's' : ''} highlighted`
          }
        </div>
        {highlightedUsers.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearAllHighlights}
            className="w-full text-xs"
          >
            Clear All Highlights
          </Button>
        )}
      </div>
    </div>
  )
})

UserSidebar.displayName = "UserSidebar"

export { UserSidebar }
