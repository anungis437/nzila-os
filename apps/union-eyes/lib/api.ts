// Union Eyes - API Client (client-safe)
//
// This module is imported by both server and client components.
// For server-side auth token injection, use lib/api-server.ts instead.
// Client-side auth relies on Clerk session cookies (withCredentials: true).

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// Use console for client-safe logging — os-core pulls in Node.js-only telemetry
const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => console.info(`[api] ${msg}`, meta ?? ''),
  error: (msg: string, meta?: Record<string, unknown>) => console.error(`[api] ${msg}`, meta ?? ''),
  warn: (msg: string, meta?: Record<string, unknown>) => console.warn(`[api] ${msg}`, meta ?? ''),
  debug: (msg: string, meta?: Record<string, unknown>) => console.debug(`[api] ${msg}`, meta ?? ''),
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * API client for Union Eyes backend.
 * 
 * On the client side, authentication works via Clerk session cookies
 * (withCredentials: true sends cookies automatically).
 * 
 * For server-side usage with Bearer token auth, use the server-only
 * `createServerApiClient()` from '@/lib/api-server'.
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api`,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Include cookies for Clerk session auth
    });

    // Request interceptor - log requests in development
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
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
