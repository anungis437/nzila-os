/**
 * TaxSlipService API Client
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
 * List tax-slip-service records
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTaxSlipServiceList(filters?: any) {
  const client = await getApiClient();
  const queryString = filters ? '?' + new URLSearchParams(filters).toString() : '';
  
  const response = await fetch(`${API_URL}/api/finance/tax-slip-service/${queryString}`, {
    method: 'GET',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tax-slip-service: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get single tax-slip-service record
 */
export async function getTaxSlipServiceById(id: string) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/finance/tax-slip-service/${{id}}/`, {
    method: 'GET',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tax-slip-service {id}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Create new tax-slip-service record
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createTaxSlipService(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/finance/tax-slip-service/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create tax-slip-service: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Update tax-slip-service record
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateTaxSlipService(id: string, data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/finance/tax-slip-service/${{id}}/`, {
    method: 'PUT',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update tax-slip-service {id}: ${response.statusText}`);
  }
  
  return response.json();
}
