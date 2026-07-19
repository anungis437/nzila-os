/**
 * LmbpImmigrationService API Client
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


/**
 * List lmbp-immigration-service records
 */
export async function getLmbpImmigrationServiceList(filters?: unknown) {
  const client = await getApiClient();
  const queryString = filters ? '?' + new URLSearchParams(filters).toString() : '';
  
  const response = await fetch(`${API_URL}/api/lmbp-immigration/lmbp-immigration-service/${queryString}`, {
    method: 'GET',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch lmbp-immigration-service: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get single lmbp-immigration-service record
 */
export async function getLmbpImmigrationServiceById(id: string) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/lmbp-immigration/lmbp-immigration-service/${{id}}/`, {
    method: 'GET',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch lmbp-immigration-service {id}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Create new lmbp-immigration-service record
 */
export async function createLmbpImmigrationService(data: unknown) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/lmbp-immigration/lmbp-immigration-service/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create lmbp-immigration-service: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Update lmbp-immigration-service record
 */
export async function updateLmbpImmigrationService(id: string, data: unknown) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/lmbp-immigration/lmbp-immigration-service/${{id}}/`, {
    method: 'PUT',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update lmbp-immigration-service {id}: ${response.statusText}`);
  }
  
  return response.json();
}
