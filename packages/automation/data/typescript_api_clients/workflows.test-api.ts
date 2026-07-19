/**
 * Workflows.test API Client
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
 * List workflows.test records
 */
export async function getWorkflows.testList(filters?: unknown) {
  const client = await getApiClient();
  const queryString = filters ? '?' + new URLSearchParams(filters).toString() : '';
  
  const response = await fetch(`${API_URL}/api/api/workflows.test/${queryString}`, {
    method: 'GET',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch workflows.test: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get single workflows.test record
 */
export async function getWorkflows.testById(id: string) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/api/workflows.test/${{id}}/`, {
    method: 'GET',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch workflows.test {id}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Create new workflows.test record
 */
export async function createWorkflows.test(data: unknown) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/api/workflows.test/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create workflows.test: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Update workflows.test record
 */
export async function updateWorkflows.test(id: string, data: unknown) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/api/workflows.test/${{id}}/`, {
    method: 'PUT',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update workflows.test {id}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Delete workflows.test record
 */
export async function deleteWorkflows.test(id: string) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/api/workflows.test/${{id}}/`, {
    method: 'DELETE',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete workflows.test {id}: ${response.statusText}`);
  }
  
  return response.json();
}
