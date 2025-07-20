// API Response wrapper
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  timestamp: string;
}

// Basic DTOs from backend
export interface NoteDto {
  id: string;
  content: string;
  authorEmail: string;
  workspaceId: string;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
  version: number;
  imageUrls?: string[];
  reactions?: NoteReactionSummaryDto[];
}

export interface NoteCreateDto {
  content: string;
  workspaceId: string;
  x: number;
  y: number;
}

export interface NoteUpdateDto {
  content: string;
  version: number;
  imageUrls?: string[];
}

export interface NotePositionUpdateDto {
  id: string;
  x: number;
  y: number;
}

export interface DeleteImageDto {
  noteId: string;
  imageUrl: string;
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  isOnline: boolean;
  lastSeen: string;
}

export interface LoginDto {
  email: string;
  displayName?: string;
}

export interface AuthResponseDto {
  token: string;
  user: UserDto;
  expiresAt: string;
}

export interface NoteReactionCreateDto {
  noteId: string;
  reactionType: string;
}

// Reaction-related DTOs
export interface NoteReactionDto {
  id: string;
  noteId: string;
  reactionType: string;
  userEmail: string;
  createdAt: string;
}

export interface NoteReactionSummaryDto {
  reactionType: string;
  count: number;
  users: string[];
  hasCurrentUser: boolean;
}

export interface NoteMoveEventDto {
  Note: NoteDto;
  MovedBy: string;
  MovedAt: string;
}

export interface PresenceUpdateDto {
  userEmail: string;
  workspaceId: string;
  isOnline: boolean;
  lastSeen: string;
}

// Reaction aggregation types (for frontend display)
export interface NoteReaction {
  reactionType: string;
  count: number;
  users: string[];
  hasCurrentUser: boolean;
}

// Frontend-specific types
export interface Note {
  id: string;
  content: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  x: number;
  y: number;
  workspaceId: string;
  version: number;
  lastModified: Date;
  collaborators: string[];
  imageUrls: string[];
  reactions: NoteReaction[];
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  noteCount: number;
  isOnline: boolean;
  lastSeen: Date;
}

export interface AuthState {
  user: UserDto | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

// SignalR Hub method types
export interface SignalREvents {
  // Server to client events
  UserJoined: (email: string) => void;
  UserLeft: (email: string) => void;
  NoteCreated: (note: NoteDto) => void;
  NoteUpdated: (note: NoteDto) => void;
  NoteMoved: (moveEventData: NoteMoveEventDto) => void;
  NoteDeleted: (noteId: string) => void;
  ReactionAdded: (reaction: NoteReactionDto) => void;
  ReactionRemoved: (reactionId: string) => void;
  UserReactionRemoved: (noteId: string, userEmail: string) => void;
  Error: (error: string) => void;
}

export interface SignalRMethods {
  // Client to server methods
  JoinWorkspace: (workspaceId: string) => Promise<void>;
  LeaveWorkspace: (workspaceId: string) => Promise<void>;
  CreateNote: (workspaceId: string, noteData: NoteCreateDto) => Promise<void>;
  UpdateNote: (noteId: string, noteData: NoteUpdateDto) => Promise<void>;
  MoveNote: (noteId: string, x: number, y: number) => Promise<void>;
  DeleteNote: (noteId: string) => Promise<void>;
  AddReaction: (workspaceId: string, reactionData: NoteReactionCreateDto) => Promise<void>;
  RemoveReaction: (workspaceId: string, reactionId: string) => Promise<void>;
  RemoveUserReaction: (workspaceId: string, noteId: string) => Promise<void>;
} 