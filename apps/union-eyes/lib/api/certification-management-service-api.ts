/**
 * CertificationManagementService API Client
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
 * List certification-management-service records
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCertificationManagementServiceList(filters?: any) {
  const client = await getApiClient();
  const queryString = filters ? '?' + new URLSearchParams(filters).toString() : '';
  
  const response = await fetch(`${API_URL}/api/certification-management/certification-management-service/${queryString}`, {
    method: 'GET',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch certification-management-service: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get single certification-management-service record
 */
export async function getCertificationManagementServiceById(id: string) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/certification-management/certification-management-service/${{id}}/`, {
    method: 'GET',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch certification-management-service {id}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Create new certification-management-service record
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createCertificationManagementService(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/certification-management/certification-management-service/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create certification-management-service: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Update certification-management-service record
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateCertificationManagementService(id: string, data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/certification-management/certification-management-service/${{id}}/`, {
    method: 'PUT',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update certification-management-service {id}: ${response.statusText}`);
  }
  
  return response.json();
}
