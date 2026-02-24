/**
 * Django REST API Client for Union Eyes
 * 
 * This module provides Phase 1 critical service API clients that call
 * the Django backend instead of using Drizzle ORM database access.
 * 
 * Usage:
 *   import { workflows, governance, certification } from '@/lib/api/django-client';
 *   
 *   const list = await governance.list();
 *   const item = await governance.get(id);
 *   const created = await governance.create(data);
 */

// Re-export all service API clients
export * from './workflows.test-api';
export * from './governance-service-api';
export * from './schema-api';
export * from './certification-management-service-api';
export * from './lmbp-immigration-service-api';
export * from './tax-slip-service-api';
export * from './signature-service-api';

/**
 * Django API Configuration
 */
export const DJANGO_API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  servicesPath: '/api/services',
  timeout: 30000, // 30 seconds
  retries: 3,
};

/**
 * API Error Class
 */
export class DjangoAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public response?: any
  ) {
    super(message);
    this.name = 'DjangoAPIError';
  }
}

/**
 * Handle Django API Response
 */
export async function handleDjangoResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: response.statusText,
    }));
    
    throw new DjangoAPIError(
      error.detail || error.message || response.statusText,
      response.status,
      error
    );
  }
  
  return response.json();
}

/**
 * Retry wrapper for Django API calls
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = DJANGO_API_CONFIG.retries
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && error instanceof DjangoAPIError && error.statusCode !== 401) {
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

/**
 * Get full Django API URL
 */
export function getDjangoAPIURL(path: string): string {
  return `${DJANGO_API_CONFIG.baseURL}${DJANGO_API_CONFIG.servicesPath}${path}`;
}
