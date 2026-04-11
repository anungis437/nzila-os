/**
 * Schema API Client
 * Calls Django REST API instead of direct database access
 */

import { auth } from '@nzila/platform-auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get authenticated API client
 */
async function getApiClient() {
  const { getToken } = auth();
  const token = await getToken();
  
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  return {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  };
}

