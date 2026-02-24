/**
 * Client-side CSRF Protection Utilities
 * 
 * Helper functions for including CSRF tokens in client-side requests.
 * 
 * Usage:
 * ```typescript
 * import { fetchWithCSRF } from '@/lib/csrf-client';
 * 
 * const response = await fetchWithCSRF('/api/users', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'John' }),
 * });
 * ```
 */

const CSRF_COOKIE_NAME = '__Host-csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Get CSRF token from cookie
 */
function getCSRFToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie.match(new RegExp(`(^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Fetch wrapper that automatically includes CSRF token
 * 
 * @param url - Request URL
 * @param options - Fetch options
 * @returns Promise<Response>
 * 
 * @example
 * ```typescript
 * // POST request with CSRF protection
 * const response = await fetchWithCSRF('/api/users', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ name: 'John Doe' }),
 * });
 * 
 * // PUT request with CSRF protection
 * const response = await fetchWithCSRF('/api/users/123', {
 *   method: 'PUT',
 *   body: JSON.stringify({ name: 'Jane Doe' }),
 * });
 * ```
 */
export async function fetchWithCSRF(
  url: string | URL,
  options?: RequestInit
): Promise<Response> {
  const method = options?.method?.toUpperCase() || 'GET';

  // Add CSRF token for state-changing requests
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const csrfToken = getCSRFToken();

    if (!csrfToken) {
}

    const headers = new Headers(options?.headers);
    
    if (csrfToken) {
      headers.set(CSRF_HEADER_NAME, csrfToken);
    }

    return fetch(url, {
      ...options,
      headers,
    });
  }

  // Safe methods - no CSRF token needed
  return fetch(url, options);
}

/**
 * Axios interceptor for CSRF protection
 * 
 * Add to axios instance:
 * ```typescript
 * import axios from 'axios';
 * import { setupAxiosCSRF } from '@/lib/csrf-client';
 * 
 * const api = axios.create({
 *   baseURL: '/api',
 * });
 * 
 * setupAxiosCSRF(api);
 * ```
 */
export function setupAxiosCSRF(axiosInstance: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (axiosInstance as any).interceptors.request.use(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (config: any) => {
      const method = config.method?.toUpperCase();

      // Add CSRF token for state-changing requests
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        const csrfToken = getCSRFToken();

        if (!csrfToken) {
} else {
          config.headers[CSRF_HEADER_NAME] = csrfToken;
        }
      }

      return config;
    },
    (error: unknown) => {
      return Promise.reject(error);
    }
  );
}

/**
 * React hook for CSRF-protected fetch
 * 
 * @example
 * ```typescript
 * import { useCSRFFetch } from '@/lib/csrf-client';
 * 
 * function MyComponent() {
 *   const csrfFetch = useCSRFFetch();
 *   
 *   const handleSubmit = async () => {
 *     const response = await csrfFetch('/api/users', {
 *       method: 'POST',
 *       body: JSON.stringify({ name: 'John' }),
 *     });
 *   };
 * }
 * ```
 */
export function useCSRFFetch() {
  return fetchWithCSRF;
}

/**
 * Get CSRF token for manual inclusion
 * 
 * Use when you need the token directly (e.g., for custom fetch implementations)
 * 
 * @example
 * ```typescript
 * import { getToken } from '@/lib/csrf-client';
 * 
 * const csrfToken = getToken();
 * 
 * const response = await fetch('/api/users', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'x-csrf-token': csrfToken || '',
 *   },
 *   body: JSON.stringify(data),
 * });
 * ```
 */
export function getToken(): string | null {
  return getCSRFToken();
}

/**
 * Check if CSRF token exists
 * 
 * Useful for debugging or conditional logic
 */
export function hasCSRFToken(): boolean {
  return getCSRFToken() !== null;
}

/**
 * React Query mutation wrapper with CSRF protection
 * 
 * @example
 * ```typescript
 * import { useMutation } from '@tanstack/react-query';
 * import { createCSRFMutation } from '@/lib/csrf-client';
 * 
 * const createUser = createCSRFMutation(async (data: UserData) => {
 *   const response = await fetch('/api/users', {
 *     method: 'POST',
 *     body: JSON.stringify(data),
 *   });
 *   return response.json();
 * });
 * 
 * function MyComponent() {
 *   const mutation = useMutation({
 *     mutationFn: createUser,
 *   });
 * }
 * ```
 */
export function createCSRFMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>
) {
  return async (variables: TVariables): Promise<TData> => {
    const csrfToken = getCSRFToken();

    if (!csrfToken) {
      throw new Error('CSRF token not found - cannot perform mutation');
    }

    return mutationFn(variables);
  };
}

/**
 * Form submit helper with CSRF protection
 * 
 * @example
 * ```typescript
 * import { submitFormWithCSRF } from '@/lib/csrf-client';
 * 
 * async function handleSubmit(event: FormEvent<HTMLFormElement>) {
 *   event.preventDefault();
 *   
 *   const response = await submitFormWithCSRF(
 *     event.currentTarget,
 *     '/api/users',
 *     'POST'
 *   );
 * }
 * ```
 */
export async function submitFormWithCSRF(
  form: HTMLFormElement,
  url: string,
  method: string = 'POST'
): Promise<Response> {
  const formData = new FormData(form);
  const csrfToken = getCSRFToken();

  if (!csrfToken) {
    throw new Error('CSRF token not found');
  }

  return fetch(url, {
    method,
    headers: {
      [CSRF_HEADER_NAME]: csrfToken,
    },
    body: formData,
  });
}

/**
 * JSON submit helper with CSRF protection
 * 
 * @example
 * ```typescript
 * import { submitJSONWithCSRF } from '@/lib/csrf-client';
 * 
 * const response = await submitJSONWithCSRF('/api/users', {
 *   name: 'John Doe',
 *   email: 'john@example.com',
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function submitJSONWithCSRF<T = any>(
  url: string,
  data: unknown,
  method: string = 'POST'
): Promise<T> {
  const csrfToken = getCSRFToken();

  if (!csrfToken) {
    throw new Error('CSRF token not found');
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      [CSRF_HEADER_NAME]: csrfToken,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
    error.response = response;
    throw error;
  }

  return response.json();
}

