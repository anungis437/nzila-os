/**
 * GovernanceService API Client
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
 * List governance-service records
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getGovernanceServiceList(filters?: any) {
  const client = await getApiClient();
  const queryString = filters ? '?' + new URLSearchParams(filters).toString() : '';
  
  const response = await fetch(`${API_URL}/api/governance/governance-service/${queryString}`, {
    method: 'GET',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch governance-service: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get single governance-service record
 */
export async function getGovernanceServiceById(id: string) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/governance/governance-service/${{id}}/`, {
    method: 'GET',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch governance-service {id}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Create new governance-service record
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createGovernanceService(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/governance/governance-service/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create governance-service: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Update governance-service record
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateGovernanceService(id: string, data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/governance/governance-service/${{id}}/`, {
    method: 'PUT',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update governance-service {id}: ${response.statusText}`);
  }
  
  return response.json();
}
