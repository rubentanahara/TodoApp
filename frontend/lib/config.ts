// Environment configuration for API endpoints
export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  signalR: {
    hubUrl: process.env.NEXT_PUBLIC_SIGNALR_URL || 'http://localhost:8080/hubs/collaboration',
    automaticReconnect: true,
    connectionTimeout: 30000,
    keepAliveInterval: 15000,
  },
  auth: {
    tokenKey: 'notes-auth-token',
    userKey: 'notes-current-user',
    refreshThreshold: 5 * 60 * 1000, // 5 minutes before expiry
  },
  workspace: {
    defaultWorkspaceId: 'demo-workspace',
    maxNotes: 1000,
    maxNoteLength: 10000,
    canvasSize: { width: 5000, height: 5000 },
  },
  performance: {
    debounceDelay: 300,
    throttleDelay: 100,
    maxVisibleNotes: 100,
  },
} as const;

// Type-safe environment variables
export const env = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  signalRUrl: process.env.NEXT_PUBLIC_SIGNALR_URL,
} as const;

// API endpoints
export const endpoints = {
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    refresh: '/api/auth/refresh',
    me: '/api/auth/me',
  },
  users: {
    online: '/api/users/online',
    presence: '/api/users/presence',
  },
  notes: {
    base: (workspaceId: string) => `/api/workspaces/${workspaceId}/notes`,
    byId: (id: string) => `/api/notes/${id}`,
    position: (id: string) => `/api/notes/${id}/position`,
  },
  health: {
    health: '/health',
    ready: '/health/ready',
    live: '/health/live',
  },
} as const; 