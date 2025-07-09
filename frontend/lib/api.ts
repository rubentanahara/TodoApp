import axios, { AxiosInstance, AxiosError } from 'axios';
import { config, endpoints } from './config';
import {
  ApiResponse,
  AuthResponseDto,
  LoginDto,
  UserDto,
  PresenceUpdateDto,
  NoteDto,
  NoteCreateDto,
  NoteUpdateDto,
  NotePositionUpdateDto,
} from '@/types/api';

// Custom error class for API errors
export class ApiServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ApiServiceError';
  }
}

// Base API service class
class ApiService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - Add auth token if available
    this.axiosInstance.interceptors.request.use(
      (requestConfig) => {
        const token = localStorage.getItem(config.auth.tokenKey);
        if (token) {
          requestConfig.headers.Authorization = `Bearer ${token}`;
        }
        return requestConfig;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - Handle errors
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiResponse<any>>) => {
        return this.handleError(error);
      }
    );
  }

  private handleError(error: AxiosError<ApiResponse<any>>): Promise<never> {
    let apiError: ApiServiceError;

    if (error.response) {
      // Server responded with an error
      const response = error.response;
      const data = response.data;
      
      apiError = new ApiServiceError(
        data?.error || 'An error occurred',
        data?.error,
        data?.data,
        response.status
      );
    } else if (error.request) {
      // Network error or no response
      apiError = new ApiServiceError(
        'Network error - please check your connection',
        'NETWORK_ERROR',
        error.request
      );
    } else {
      // Request setup error
      apiError = new ApiServiceError(
        'Request configuration error',
        'REQUEST_ERROR',
        error.message
      );
    }

    // Handle specific error cases
    if (apiError.statusCode === 401) {
      // Unauthorized - clear auth data
      localStorage.removeItem(config.auth.tokenKey);
      localStorage.removeItem(config.auth.userKey);
      
      // Redirect to login if not already on login page
      if (typeof window !== 'undefined' && !window.location.pathname.includes('login')) {
        window.location.href = '/';
      }
    }

    return Promise.reject(apiError);
  }

  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    retries: number = config.api.retryAttempts
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      if (retries > 0 && error instanceof ApiServiceError) {
        // Only retry on network errors or server errors (5xx)
        if (error.code === 'NETWORK_ERROR' || (error.statusCode && error.statusCode >= 500)) {
          await new Promise(resolve => setTimeout(resolve, config.api.retryDelay));
          return this.retryRequest(requestFn, retries - 1);
        }
      }
      throw error;
    }
  }

  private async request<T>(method: string, url: string, data?: any): Promise<T> {
    const response = await this.axiosInstance.request({
      method,
      url,
      data,
    });
    
    // Handle ApiResponse wrapper
    const apiResponse = response.data as ApiResponse<T>;
    if (apiResponse.success) {
      return apiResponse.data;
    } else {
      throw new ApiServiceError(apiResponse.error || 'Request failed');
    }
  }

  // Authentication methods
  async login(loginData: LoginDto): Promise<AuthResponseDto> {
    return this.retryRequest(() => this.request<AuthResponseDto>('POST', endpoints.auth.login, loginData));
  }

  async logout(): Promise<boolean> {
    return this.retryRequest(() => this.request<boolean>('POST', endpoints.auth.logout));
  }

  async refreshToken(): Promise<AuthResponseDto> {
    return this.retryRequest(() => this.request<AuthResponseDto>('POST', endpoints.auth.refresh));
  }

  async getCurrentUser(): Promise<UserDto> {
    return this.retryRequest(() => this.request<UserDto>('GET', endpoints.auth.me));
  }

  // User methods
  async getOnlineUsers(): Promise<UserDto[]> {
    return this.retryRequest(() => this.request<UserDto[]>('GET', endpoints.users.online));
  }

  async updatePresence(presence: PresenceUpdateDto): Promise<boolean> {
    return this.retryRequest(() => this.request<boolean>('PUT', endpoints.users.presence, presence));
  }

  // Note methods
  async getNotes(
    workspaceId: string,
    viewport?: {
      x: number;
      y: number;
      width: number;
      height: number;
    }
  ): Promise<NoteDto[]> {
    return this.retryRequest(async () => {
      const params = viewport ? {
        viewportX: viewport.x,
        viewportY: viewport.y,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
      } : {};

      const response = await this.axiosInstance.get(endpoints.notes.base(workspaceId), { params });
      const apiResponse = response.data as ApiResponse<NoteDto[]>;
      if (apiResponse.success) {
        return apiResponse.data;
      } else {
        throw new ApiServiceError(apiResponse.error || 'Failed to get notes');
      }
    });
  }

  async getNote(noteId: string): Promise<NoteDto> {
    return this.retryRequest(() => this.request<NoteDto>('GET', endpoints.notes.byId(noteId)));
  }

  async createNote(workspaceId: string, noteData: NoteCreateDto): Promise<NoteDto> {
    return this.retryRequest(() => this.request<NoteDto>('POST', endpoints.notes.base(workspaceId), noteData));
  }

  async updateNote(noteId: string, noteData: NoteUpdateDto): Promise<NoteDto> {
    return this.retryRequest(() => this.request<NoteDto>('PUT', endpoints.notes.byId(noteId), noteData));
  }

  async deleteNote(noteId: string): Promise<boolean> {
    return this.retryRequest(() => this.request<boolean>('DELETE', endpoints.notes.byId(noteId)));
  }

  async moveNote(noteId: string, position: NotePositionUpdateDto): Promise<NoteDto> {
    return this.retryRequest(() => this.request<NoteDto>('PATCH', endpoints.notes.position(noteId), position));
  }

  // Health check methods
  async checkHealth(): Promise<any> {
    return this.retryRequest(async () => {
      const response = await this.axiosInstance.get(endpoints.health.health);
      return response.data;
    });
  }

  async checkReadiness(): Promise<any> {
    return this.retryRequest(async () => {
      const response = await this.axiosInstance.get(endpoints.health.ready);
      return response.data;
    });
  }

  async checkLiveness(): Promise<any> {
    return this.retryRequest(async () => {
      const response = await this.axiosInstance.get(endpoints.health.live);
      return response.data;
    });
  }
}

// Create and export singleton instance
export const apiService = new ApiService();
export default apiService; 