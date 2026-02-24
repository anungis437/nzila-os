/**
 * WorkflowsTest API Client
 * Calls Django REST API instead of direct database access
 */

import { auth } from '@clerk/nextjs/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get authenticated API client
 */
async function getApiClient() {
  const { getToken } = await auth();
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
 * List WorkflowsTest records
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getWorkflowsTestList(filters?: any) {
  const client = await getApiClient();
  const queryString = filters ? '?' + new URLSearchParams(filters).toString() : '';
  
  const response = await fetch(`${API_URL}/api/api/WorkflowsTest/${queryString}`, {
    method: 'GET',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch WorkflowsTest: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get single WorkflowsTest record
 */
export async function getWorkflowsTestById(id: string) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/api/WorkflowsTest/${{id}}/`, {
    method: 'GET',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch WorkflowsTest {id}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Create new WorkflowsTest record
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createWorkflowsTest(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/api/WorkflowsTest/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create WorkflowsTest: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Update WorkflowsTest record
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateWorkflowsTest(id: string, data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/api/WorkflowsTest/${{id}}/`, {
    method: 'PUT',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update WorkflowsTest {id}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Delete WorkflowsTest record
 */
export async function deleteWorkflowsTest(id: string) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/api/WorkflowsTest/${{id}}/`, {
    method: 'DELETE',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete WorkflowsTest {id}: ${response.statusText}`);
  }
  
  return response.json();
}
