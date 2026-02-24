// Union Eyes - Server-only API Client with Clerk authentication
//
// This module uses @clerk/nextjs/server and MUST only be imported
// from Server Components, API routes, or server actions.
// For client components, use lib/api.ts instead.

import 'server-only';

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { auth } from '@clerk/nextjs/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Server-side API client with automatic Clerk JWT injection.
 * Only usable from Server Components, API routes, and server actions.
 */
class ServerApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add Clerk Bearer token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        try {
          const { getToken } = await auth();
          const token = await getToken();

          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.warn('Failed to get Clerk token:', error);
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status && error.response.status >= 500) {
          console.error('API Server Error:', error.response.data);
        }
        return Promise.reject(error);
      }
    );
  }

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

export const serverApi = new ServerApiClient();
