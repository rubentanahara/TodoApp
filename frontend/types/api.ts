// API Response wrapper
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  timestamp: string;
}

// User-related DTOs
export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  lastSeen: string;
  isOnline: boolean;
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

export interface PresenceUpdateDto {
  isOnline: boolean;
}

// Note-related DTOs
export interface NoteDto {
  id: string;
  content: string;
  authorEmail: string;
  x: number;
  y: number;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface NoteCreateDto {
  content: string;
  x: number;
  y: number;
}

export interface NoteUpdateDto {
  content?: string;
  x?: number;
  y?: number;
  version: number;
}

export interface NotePositionUpdateDto {
  x: number;
  y: number;
}

// SignalR-related types
export interface UserCursor {
  userEmail: string;
  workspaceId: string;
  x: number;
  y: number;
  lastUpdated: string;
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
  lastModified?: Date;
  collaborators?: string[];
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  noteCount: number;
  isOnline: boolean;
  lastSeen: Date;
  cursor?: { x: number; y: number };
  activeNoteId?: string;
}

export interface AuthState {
  user: UserDto | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// API Error types
export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// SignalR Hub method types
export interface SignalREvents {
  // Server to client events
  UserJoined: (email: string) => void;
  UserLeft: (email: string) => void;
  CursorMoved: (email: string, x: number, y: number) => void;
  NoteCreated: (note: NoteDto) => void;
  NoteUpdated: (note: NoteDto) => void;
  NoteMoved: (note: NoteDto) => void;
  NoteDeleted: (noteId: string) => void;
  Error: (error: string) => void;
}

export interface SignalRMethods {
  // Client to server methods
  JoinWorkspace: (workspaceId: string) => Promise<void>;
  LeaveWorkspace: (workspaceId: string) => Promise<void>;
  UpdateCursor: (workspaceId: string, x: number, y: number) => Promise<void>;
  CreateNote: (workspaceId: string, noteData: NoteCreateDto) => Promise<void>;
  UpdateNote: (noteId: string, noteData: NoteUpdateDto) => Promise<void>;
  MoveNote: (noteId: string, x: number, y: number) => Promise<void>;
  DeleteNote: (noteId: string) => Promise<void>;
} 