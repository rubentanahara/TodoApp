'use client'

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';
import { apiService } from './api';
import { config } from './config';
import { AuthState, UserDto, LoginDto, AuthResponseDto } from '@/types/api';

// JWT payload interface
interface JwtPayload {
  exp: number;
  email: string;
  [key: string]: any;
}

// Authentication service class
class AuthService {
  private static instance: AuthService;
  private currentUser: UserDto | null = null;
  private token: string | null = null;
  private refreshTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Load authentication data from localStorage
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    const storedToken = localStorage.getItem(config.auth.tokenKey);
    const storedUser = localStorage.getItem(config.auth.userKey);

    if (storedToken && storedUser) {
      try {
        this.token = storedToken;
        this.currentUser = JSON.parse(storedUser);
        
        // Check if token is still valid
        if (this.isTokenValid(storedToken)) {
          this.scheduleTokenRefresh();
        } else {
          this.logout();
        }
      } catch (error) {
        console.error('Error loading auth data from storage:', error);
        this.logout();
      }
    }
  }

  // Save authentication data to localStorage
  private saveToStorage(token: string, user: UserDto): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem(config.auth.tokenKey, token);
    localStorage.setItem(config.auth.userKey, JSON.stringify(user));
  }

  // Clear authentication data from localStorage
  private clearStorage(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(config.auth.tokenKey);
    localStorage.removeItem(config.auth.userKey);
  }

  // Check if token is valid and not expired
  private isTokenValid(token: string): boolean {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      const currentTime = Date.now() / 1000;
      return decoded.exp > currentTime;
    } catch (error) {
      console.error('Error decoding token:', error);
      return false;
    }
  }

  // Get token expiration time
  private getTokenExpiration(token: string): number | null {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return decoded.exp * 1000; // Convert to milliseconds
    } catch (error) {
      console.error('Error getting token expiration:', error);
      return null;
    }
  }

  // Schedule automatic token refresh
  private scheduleTokenRefresh(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    if (!this.token) return;

    const expirationTime = this.getTokenExpiration(this.token);
    if (!expirationTime) return;

    const refreshTime = expirationTime - Date.now() - config.auth.refreshThreshold;
    
    if (refreshTime > 0) {
      this.refreshTimeout = setTimeout(() => {
        this.refreshToken();
      }, refreshTime);
    }
  }

  // Login method
  async login(loginData: LoginDto): Promise<AuthState> {
    try {
      const response: AuthResponseDto = await apiService.login(loginData);
      
      this.token = response.token;
      this.currentUser = response.user;
      
      this.saveToStorage(response.token, response.user);
      this.scheduleTokenRefresh();

      return {
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      };
    } catch (error) {
      this.logout();
      throw error;
    }
  }

  // Logout method
  async logout(): Promise<void> {
    try {
      // Call backend logout if user is authenticated
      if (this.token) {
        await apiService.logout();
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Clear local state regardless of backend call success
      this.token = null;
      this.currentUser = null;
      this.clearStorage();
      
      if (this.refreshTimeout) {
        clearTimeout(this.refreshTimeout);
        this.refreshTimeout = null;
      }
    }
  }

  // Refresh token method
  async refreshToken(): Promise<AuthState> {
    try {
      const response: AuthResponseDto = await apiService.refreshToken();
      
      this.token = response.token;
      this.currentUser = response.user;
      
      this.saveToStorage(response.token, response.user);
      this.scheduleTokenRefresh();

      return {
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      };
    } catch (error) {
      this.logout();
      throw error;
    }
  }

  // Get current authentication state
  getAuthState(): AuthState {
    return {
      user: this.currentUser,
      token: this.token,
      isAuthenticated: this.token !== null && this.currentUser !== null,
      isLoading: false,
    };
  }

  // Get current user
  getCurrentUser(): UserDto | null {
    return this.currentUser;
  }

  // Get current token
  getToken(): string | null {
    return this.token;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.token !== null && this.currentUser !== null && this.isTokenValid(this.token);
  }

  // Get current user info from backend
  async getCurrentUserInfo(): Promise<UserDto> {
    const user = await apiService.getCurrentUser();
    this.currentUser = user;
    
    if (this.token) {
      this.saveToStorage(this.token, user);
    }
    
    return user;
  }
}

// Create singleton instance
export const authService = AuthService.getInstance();

// Authentication context type
interface AuthContextType {
  authState: AuthState;
  login: (loginData: LoginDto) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  isLoading: boolean;
}

// React Context for authentication
export const AuthContext = createContext<AuthContextType | null>(null);

// Custom hook for authentication
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Authentication provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const initialState = authService.getAuthState();
        
        // If user appears to be authenticated, verify with backend
        if (initialState.isAuthenticated) {
          try {
            await authService.getCurrentUserInfo();
            setAuthState(authService.getAuthState());
          } catch (error) {
            // If verification fails, logout
            await authService.logout();
            setAuthState(authService.getAuthState());
          }
        } else {
          setAuthState(initialState);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setAuthState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Login handler
  const login = useCallback(async (loginData: LoginDto) => {
    setIsLoading(true);
    try {
      const newState = await authService.login(loginData);
      setAuthState(newState);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout handler
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh token handler
  const refreshToken = useCallback(async () => {
    try {
      const newState = await authService.refreshToken();
      setAuthState(newState);
    } catch (error) {
      // If refresh fails, logout
      await logout();
    }
  }, [logout]);

  const value: AuthContextType = {
    authState,
    login,
    logout,
    refreshToken,
    isLoading,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

// Hook for checking authentication status
export const useAuthCheck = () => {
  const { authState } = useAuth();
  return {
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    isLoading: authState.isLoading,
  };
};

// Hook for authentication actions
export const useAuthActions = () => {
  const { login, logout, refreshToken } = useAuth();
  return {
    login,
    logout,
    refreshToken,
  };
};

export default authService; 