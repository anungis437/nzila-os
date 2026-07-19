/**
 * External API Client with Circuit Breaker Support
 * 
 * Provides resilient HTTP client for external API calls
 * with automatic circuit breaking, retries, and timeouts
 * 
 * Usage:
 *   import { createApiClient } from '@/lib/api-client';
 * 
 *   const client = createApiClient('stripe-api', {
 *     baseURL: 'https://api.stripe.com',
 *     timeout: 30000,
 *   });
 * 
 *   const response = await client.get('/v1/customers');
 */

import { circuitBreakers, CIRCUIT_BREAKERS } from './circuit-breaker';
import { logger } from './logger';
export interface ApiClientConfig {
  /** Base URL for the API */
  baseURL?: string;
  
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Default headers */
  headers?: Record<string, string>;
  
  /** Number of retry attempts */
  retries?: number;
  
  /** Retry delay in milliseconds */
  retryDelay?: number;
  
  /** Circuit breaker config (uses defaults if not specified) */
  circuitBreaker?: {
    threshold?: number;
    timeout?: number;
    successThreshold?: number;
  };
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
}

export interface ApiError extends Error {
  status?: number;
  response?: any;
  isTimeout?: boolean;
}

/**
 * Create a resilient API client with circuit breaker
 */
export function createApiClient(name: string, config: ApiClientConfig = {}) {
  const {
    baseURL = '',
    timeout = 30000,
    headers: defaultHeaders = {},
    retries = 3,
    retryDelay = 1000,
    circuitBreaker: cbConfig = CIRCUIT_BREAKERS.EXTERNAL_API,
  } = config;

  // Get or create circuit breaker for this API
  const breaker = circuitBreakers.get(`api-${name}`, {
    threshold: cbConfig.threshold ?? CIRCUIT_BREAKERS.EXTERNAL_API.threshold,
    timeout: cbConfig.timeout ?? CIRCUIT_BREAKERS.EXTERNAL_API.timeout,
    successThreshold: cbConfig.successThreshold ?? CIRCUIT_BREAKERS.EXTERNAL_API.successThreshold,
  });

  /**
   * Make HTTP request with circuit breaker protection
   */
  async function request<T = unknown>(
    method: string,
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = baseURL + path;
    let lastError: ApiError | undefined;

    // Retry loop
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Use circuit breaker to protect request
        return await breaker.execute(async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          try {
            const response = await fetch(url, {
              ...options,
              method,
              headers: {
                'Content-Type': 'application/json',
                ...defaultHeaders,
                ...options.headers,
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Check for HTTP errors
            if (!response.ok) {
              const error: ApiError = new Error(
                `HTTP ${response.status}: ${response.statusText}`
              );
              error.name = 'ApiError';
              error.status = response.status;
              
              try {
                error.response = await response.json();
              } catch {
                error.response = await response.text();
              }
              
              throw error;
            }

            // Parse response
            const data = await response.json();

            logger.info(`API request successful: ${name}`, {
              method,
              path,
              status: response.status,
              attempt: attempt + 1,
            });

            return {
              data,
              status: response.status,
              headers: response.headers,
            };

          } catch (error) {
            clearTimeout(timeoutId);
            
            if (error instanceof Error && error.name === 'AbortError') {
              const timeoutError: ApiError = new Error(
                `Request timeout after ${timeout}ms`
              );
              timeoutError.name = 'TimeoutError';
              timeoutError.isTimeout = true;
              throw timeoutError;
            }
            
            throw error;
          }
        });

      } catch (error) {
        lastError = error as ApiError;

        // Don&apos;t retry on certain errors
        const shouldNotRetry = 
          lastError.status === 400 || // Bad request
          lastError.status === 401 || // Unauthorized
          lastError.status === 403 || // Forbidden
          lastError.status === 404;   // Not found

        if (shouldNotRetry || attempt === retries) {
          logger.error(`API request failed: ${name}`, error, {
            method,
            path,
            attempts: attempt + 1,
            status: lastError.status,
          });
          throw lastError;
        }

        // Wait before retry
        const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
        logger.warn(`API request failed, retrying: ${name}`, {
          method,
          path,
          attempt: attempt + 1,
          retryIn: delay,
          error: lastError.message,
        });

        await sleep(delay);
      }
    }

    throw lastError!;
  }

  return {
    /**
     * GET request
     */
    get<T = unknown>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
      return request<T>('GET', path, options);
    },

    /**
     * POST request
     */
    post<T = unknown>(
      path: string,
      body?: any,
      options?: RequestInit
    ): Promise<ApiResponse<T>> {
      return request<T>('POST', path, {
        ...options,
        body: body ? JSON.stringify(body) : undefined,
      });
    },

    /**
     * PUT request
     */
    put<T = unknown>(
      path: string,
      body?: any,
      options?: RequestInit
    ): Promise<ApiResponse<T>> {
      return request<T>('PUT', path, {
        ...options,
        body: body ? JSON.stringify(body) : undefined,
      });
    },

    /**
     * PATCH request
     */
    patch<T = unknown>(
      path: string,
      body?: any,
      options?: RequestInit
    ): Promise<ApiResponse<T>> {
      return request<T>('PATCH', path, {
        ...options,
        body: body ? JSON.stringify(body) : undefined,
      });
    },

    /**
     * DELETE request
     */
    delete<T = unknown>(
      path: string,
      options?: RequestInit
    ): Promise<ApiResponse<T>> {
      return request<T>('DELETE', path, options);
    },

    /**
     * Get circuit breaker stats
     */
    getStats() {
      return breaker.getStats();
    },

    /**
     * Reset circuit breaker (for testing/admin)
     */
    resetCircuitBreaker() {
      breaker.reset();
    },
  };
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pre-configured API clients for common services
 */

/**
 * Stripe API client
 */
export const stripeClient = process.env.STRIPE_SECRET_KEY
  ? createApiClient('stripe', {
      baseURL: 'https://api.stripe.com',
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
    })
  : null;

/**
 * Generic external API client factory
 * Use this for one-off external API calls
 */
export function createExternalApiClient(
  name: string,
  baseURL: string,
  headers: Record<string, string> = {}
) {
  return createApiClient(name, {
    baseURL,
    timeout: 30000,
    headers,
    retries: 3,
  });
}

/**
 * Health check endpoint for monitoring circuit breakers
 */
export function getApiHealthStatus() {
  return circuitBreakers.getAllStats();
}
