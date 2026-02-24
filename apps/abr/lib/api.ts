// ABR Insights - Clerk-Integrated API Client

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { auth } from '@clerk/nextjs/server';
import { createLogger } from '@nzila/os-core'

const logger = createLogger('api')

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

/**
 * API client for ABR Insights backend
 * Automatically includes Clerk JWT token in all requests
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api`,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Include credentials for CORS
    });

    // Request interceptor - add Clerk token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        try {
          // Get token from Clerk (server-side)
          const { getToken } = await auth();
          const token = await getToken();
          
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          logger.warn('Failed to get Clerk token:', error instanceof Error ? error : { detail: error });
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - redirect to sign-in
          if (typeof window !== 'undefined') {
            window.location.href = '/sign-in';
          }
        }
        
        // Log other errors for debugging
        if (error.response?.status && error.response.status >= 500) {
          logger.error('API Server Error:', error.response.data instanceof Error ? error.response.data : { detail: error.response.data });
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Health check (public endpoint)
  async healthCheck() {
    const response = await this.client.get('/auth_core/health/');
    return response.data;
  }

  // Get current user profile
  async getCurrentUser() {
    const response = await this.client.get('/auth_core/me/');
    return response.data;
  }

  // Generic CRUD methods
  async get<T>(endpoint: string, params?: object) {
    const response = await this.client.get<T>(endpoint, { params });
    return response.data;
  }

  async post<T>(endpoint: string, data: object) {
    const response = await this.client.post<T>(endpoint, data);
    return response.data;
  }

  async put<T>(endpoint: string, data: object) {
    const response = await this.client.put<T>(endpoint, data);
    return response.data;
  }

  async patch<T>(endpoint: string, data: object) {
    const response = await this.client.patch<T>(endpoint, data);
    return response.data;
  }

  async delete<T>(endpoint: string) {
    const response = await this.client.delete<T>(endpoint);
    return response.data;
  }
}

export const api = new ApiClient();

// Type-safe API methods
export const apiHealth = () => api.healthCheck();
export const apiGetCurrentUser = () => api.getCurrentUser();
