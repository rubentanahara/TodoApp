import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { config } from './config';
import { authService } from './auth';
import { 
  NoteDto, 
  NoteCreateDto, 
  NoteUpdateDto, 
  SignalREvents, 
  SignalRMethods 
} from '@/types/api';
import { useState, useEffect } from 'react';

// SignalR connection state
export interface SignalRState {
  isConnected: boolean;
  connectionId: string | null;
  isReconnecting: boolean;
  lastError: string | null;
}

// Event listener type
type EventListener<T extends keyof SignalREvents> = SignalREvents[T];

// SignalR service class
class SignalRService {
  private static instance: SignalRService;
  private connection: HubConnection | null = null;
  private currentWorkspace: string | null = null;
  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private isInitialized = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    // Handle page reload/close events
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        console.log('Page unloading, cleaning up SignalR...');
        this.disconnect().catch(console.error);
      });

      // Handle page visibility changes (for mobile/background scenarios)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          console.log('Page became visible, checking SignalR connection...');
          this.checkAndReconnect();
        }
      });
    }
  }

  static getInstance(): SignalRService {
    if (!SignalRService.instance) {
      SignalRService.instance = new SignalRService();
    }
    return SignalRService.instance;
  }

  // Initialize SignalR connection
  async initialize(): Promise<void> {
    // On page reload, we need to reinitialize even if marked as initialized
    const isPageReload = !this.connection || this.connection.state === HubConnectionState.Disconnected;
    
    if (this.isInitialized && this.connection && this.connection.state === HubConnectionState.Connected) {
      console.log('SignalR already initialized and connected, state:', this.connection.state);
      return;
    }

    if (isPageReload) {
      console.log('Page reload detected or connection lost, reinitializing SignalR...');
      this.reset();
    }

    try {
      console.log('Initializing SignalR connection...');
      
      // Build connection
      this.connection = new HubConnectionBuilder()
        .withUrl(config.signalR.hubUrl, {
          accessTokenFactory: () => {
            const token = authService.getToken();
            return token || '';
          },
          withCredentials: false,
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            // Exponential backoff with jitter
            const delay = Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
            return delay + Math.random() * 1000;
          },
        })
        .configureLogging(LogLevel.Information)
        .build();

      // Set up event handlers
      this.setupEventHandlers();

      console.log('Starting SignalR connection...');
      // Start connection
      await this.connection.start();
      
      console.log('SignalR connection started, state:', this.connection.state);
      
      this.isInitialized = true;
      this.reconnectAttempts = 0;
      
      // Wait a bit to ensure connection state is fully updated
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify connection state and emit Connected event
      if (this.connection.state === HubConnectionState.Connected) {
        console.log('SignalR connected successfully, emitting Connected event');
        this.emit('Connected');
      } else {
        console.warn('SignalR connection completed but state is not Connected:', this.connection.state);
        // Try waiting a bit more and check again
        setTimeout(() => {
          if (this.connection && this.connection.state === HubConnectionState.Connected) {
            console.log('SignalR connected after delay, emitting Connected event');
            this.emit('Connected');
          }
        }, 100);
      }
      
    } catch (error) {
      console.error('Error initializing SignalR:', error);
      this.emit('Error', error instanceof Error ? error.message : 'Failed to connect');
      throw error;
    }
  }

  // Setup event handlers for connection lifecycle
  private setupEventHandlers(): void {
    if (!this.connection) return;

    // Connection closed
    this.connection.onclose((error) => {
      console.log('SignalR connection closed', error);
      this.emit('Disconnected', error?.message);
      this.handleReconnect();
    });

    // Connection reconnecting
    this.connection.onreconnecting((error) => {
      console.log('SignalR reconnecting', error);
      this.emit('Reconnecting', error?.message);
    });

    // Connection reconnected
    this.connection.onreconnected((connectionId) => {
      console.log('SignalR reconnected', connectionId);
      this.reconnectAttempts = 0;
      this.emit('Reconnected', connectionId);
      
      // Rejoin workspace if we were in one
      if (this.currentWorkspace) {
        this.joinWorkspace(this.currentWorkspace);
      }
    });

    // Set up server-to-client event handlers
    this.connection.on('UserJoined', (email: string) => {
      this.emit('UserJoined', email);
    });

    this.connection.on('UserLeft', (email: string) => {
      console.log(`👋 User left workspace: ${email}`);
      this.emit('UserLeft', email);
    });

    this.connection.on('CursorMoved', (email: string, x: number, y: number) => {
      this.emit('CursorMoved', email, x, y);
    });

    this.connection.on('NoteCreated', (note: NoteDto) => {
      this.emit('NoteCreated', note);
    });

    this.connection.on('NoteUpdated', (note: NoteDto) => {
      this.emit('NoteUpdated', note);
    });

    this.connection.on('NoteMoved', (note: NoteDto) => {
      this.emit('NoteMoved', note);
    });

    this.connection.on('NoteDeleted', (noteId: string) => {
      this.emit('NoteDeleted', noteId);
    });

    this.connection.on('Error', (error: string) => {
      console.error('SignalR server error:', error);
      this.emit('Error', error);
    });
  }

  // Reset the service state (for page reloads)
  private reset(): void {
    console.log('Resetting SignalR service state...');
    if (this.connection) {
      this.connection.stop().catch(console.error);
      this.connection = null;
    }
    this.currentWorkspace = null;
    this.isInitialized = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    // Clear event listeners to prevent memory leaks
    this.eventListeners.clear();
  }

  // Handle reconnection logic
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('MaxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.handleReconnect();
      }
    }, delay);
  }

  // Get connection state
  getState(): SignalRState {
    return {
      isConnected: this.connection?.state === HubConnectionState.Connected,
      connectionId: this.connection?.connectionId || null,
      isReconnecting: this.connection?.state === HubConnectionState.Reconnecting,
      lastError: null, // Could be enhanced to track last error
    };
  }

  // Event emission system
  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in SignalR event listener for ${event}:`, error);
        }
      });
    }
  }

  // Add event listener
  on<T extends keyof SignalREvents>(event: T, listener: EventListener<T>): void;
  on(event: string, listener: (...args: any[]) => void): void;
  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  // Remove event listener
  off<T extends keyof SignalREvents>(event: T, listener: EventListener<T>): void;
  off(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  // Remove all listeners for an event
  removeAllListeners(event?: string): void {
    if (event) {
      this.eventListeners.delete(event);
    } else {
      this.eventListeners.clear();
    }
  }

  // Client-to-server methods
  async joinWorkspace(workspaceId: string): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      console.log(`Cannot join workspace ${workspaceId} - SignalR not connected`);
      throw new Error('SignalR not connected');
    }

    try {
      await this.connection.invoke('JoinWorkspace', workspaceId);
      this.currentWorkspace = workspaceId;
      console.log(`Joined workspace: ${workspaceId}`);
    } catch (error) {
      console.error('Error joining workspace:', error);
      throw error;
    }
  }

  async leaveWorkspace(workspaceId: string): Promise<void> {
    console.log(`🚪 Attempting to leave workspace: ${workspaceId}`);
    
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      // Silently handle disconnected state during cleanup
      console.log(`⚠️ Cannot leave workspace ${workspaceId} - SignalR not connected (state: ${this.connection?.state})`);
      if (this.currentWorkspace === workspaceId) {
        this.currentWorkspace = null;
      }
      return;
    }

    try {
      console.log(`📡 Invoking LeaveWorkspace for: ${workspaceId}`);
      await this.connection.invoke('LeaveWorkspace', workspaceId);
      if (this.currentWorkspace === workspaceId) {
        this.currentWorkspace = null;
      }
      console.log(`✅ Successfully left workspace: ${workspaceId}`);
    } catch (error) {
      console.error(`❌ Error leaving workspace ${workspaceId}:`, error);
      // Don't throw error for workspace leaving to avoid disrupting cleanup
      if (this.currentWorkspace === workspaceId) {
        this.currentWorkspace = null;
      }
    }
  }

  async updateCursor(workspaceId: string, x: number, y: number): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      return; // Silently fail for cursor updates
    }

    try {
      await this.connection.invoke('UpdateCursor', workspaceId, x, y);
    } catch (error) {
      console.error('Error updating cursor:', error);
      // Don't throw for cursor updates to avoid disrupting user experience
    }
  }

  async createNote(workspaceId: string, noteData: NoteCreateDto): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('SignalR not connected');
    }

    try {
      await this.connection.invoke('CreateNote', workspaceId, noteData);
    } catch (error) {
      console.error('Error creating note via SignalR:', error);
      throw error;
    }
  }

  async updateNote(noteId: string, noteData: NoteUpdateDto): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('SignalR not connected');
    }

    try {
      await this.connection.invoke('UpdateNote', noteId, noteData);
    } catch (error) {
      console.error('Error updating note via SignalR:', error);
      throw error;
    }
  }

  async moveNote(noteId: string, x: number, y: number): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('SignalR not connected');
    }

    try {
      await this.connection.invoke('MoveNote', noteId, x, y);
    } catch (error) {
      console.error('Error moving note via SignalR:', error);
      throw error;
    }
  }

  async deleteNote(noteId: string): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('SignalR not connected');
    }

    try {
      await this.connection.invoke('DeleteNote', noteId);
    } catch (error) {
      console.error('Error deleting note via SignalR:', error);
      throw error;
    }
  }

  // Disconnect from SignalR
  async disconnect(): Promise<void> {
    console.log('🔌 Starting SignalR disconnect process...');
    
    if (this.connection) {
      console.log(`📡 Connection state before disconnect: ${this.connection.state}`);
      try {
        console.log('🛑 Stopping SignalR connection...');
        await this.connection.stop();
        console.log('✅ SignalR connection stopped successfully');
      } catch (error) {
        console.error('❌ Error stopping SignalR connection:', error);
      }
      
      this.connection = null;
      this.currentWorkspace = null;
      this.isInitialized = false;
      this.reconnectAttempts = 0;
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      console.log('🧹 SignalR cleanup completed');
    } else {
      console.log('⚠️ No SignalR connection to disconnect');
    }
  }

  // Get current workspace
  getCurrentWorkspace(): string | null {
    return this.currentWorkspace;
  }

  // Check if connected
  isConnected(): boolean {
    return this.connection?.state === HubConnectionState.Connected;
  }

  // Check connection and reconnect if needed
  private checkAndReconnect(): void {
    if (!this.isConnected() && this.connection?.state !== HubConnectionState.Reconnecting) {
      console.log('Connection lost, attempting to reconnect...');
      this.initialize().catch(console.error);
    }
  }
}

// Create and export singleton instance
export const signalRService = SignalRService.getInstance();

// Custom React hook for SignalR
export const useSignalR = (workspaceId?: string) => {
  const [state, setState] = useState<SignalRState>({
    isConnected: false,
    connectionId: null,
    isReconnecting: false,
    lastError: null,
  });

  useEffect(() => {
    const updateState = () => {
      setState(signalRService.getState());
    };

    // Handler for when connection is established
    const handleConnected = () => {
      console.log('SignalR Connected event received, current state:', signalRService.getState());
      updateState();
      
      // Join workspace after connection is established - with additional safety check
      if (workspaceId && signalRService.isConnected()) {
        console.log('Attempting to join workspace:', workspaceId);
        signalRService.joinWorkspace(workspaceId).catch((error) => {
          console.error('Failed to join workspace on Connected event:', error);
        });
      } else if (workspaceId) {
        console.log('Workspace join skipped - SignalR not connected yet');
        // Retry after a short delay
        setTimeout(() => {
          if (signalRService.isConnected()) {
            console.log('Retrying workspace join after delay:', workspaceId);
            signalRService.joinWorkspace(workspaceId).catch(console.error);
          }
        }, 100);
      }
    };

    // Set up event listeners
    signalRService.on('Connected', handleConnected);
    signalRService.on('Disconnected', updateState);
    signalRService.on('Reconnecting', updateState);
    signalRService.on('Reconnected', () => {
      updateState();
      // Rejoin workspace after reconnection
      if (workspaceId) {
        signalRService.joinWorkspace(workspaceId).catch(console.error);
      }
    });
    signalRService.on('Error', (error: string) => {
      setState(prev => ({ ...prev, lastError: error }));
    });

    // Initialize connection
    signalRService.initialize().catch(console.error);

    // Join workspace if already connected
    if (workspaceId && signalRService.isConnected()) {
      signalRService.joinWorkspace(workspaceId).catch(console.error);
    }

    // Set up periodic check for workspace joining (backup mechanism)
    let joinAttempts = 0;
    const maxJoinAttempts = 10;
    const joinInterval = setInterval(() => {
      if (workspaceId && signalRService.isConnected() && 
          signalRService.getCurrentWorkspace() !== workspaceId) {
        console.log('Periodic check: attempting to join workspace', workspaceId);
        signalRService.joinWorkspace(workspaceId)
          .then(() => {
            clearInterval(joinInterval);
          })
          .catch((error) => {
            console.error('Periodic join attempt failed:', error);
            joinAttempts++;
            if (joinAttempts >= maxJoinAttempts) {
              console.error('Max join attempts reached, stopping periodic checks');
              clearInterval(joinInterval);
            }
          });
      } else if (!workspaceId || signalRService.getCurrentWorkspace() === workspaceId) {
        clearInterval(joinInterval);
      }
    }, 500);

    return () => {
      // Clean up periodic join interval
      clearInterval(joinInterval);
      
      // Clean up event listeners
      signalRService.off('Connected', handleConnected);
      signalRService.off('Disconnected', updateState);
      signalRService.off('Reconnecting', updateState);
      signalRService.off('Reconnected', updateState);
      
      // Leave workspace on cleanup - now gracefully handles disconnected state
      if (workspaceId) {
        signalRService.leaveWorkspace(workspaceId).catch(console.error);
      }
    };
  }, [workspaceId]);

  return {
    ...state,
    signalRService,
  };
};

export default signalRService; 