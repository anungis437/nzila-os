/**
 * SignatureService API Client
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
 * List signature-service records
 */
export async function getSignatureServiceList(filters?: any) {
  const client = await getApiClient();
  const queryString = filters ? '?' + new URLSearchParams(filters).toString() : '';
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/${queryString}`, {
    method: 'GET',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch signature-service: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get single signature-service record
 */
export async function getSignatureServiceById(id: string) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/${{id}}/`, {
    method: 'GET',
    headers: client.headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch signature-service {id}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Create new signature-service record
 */
export async function createSignatureService(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create signature-service: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Update signature-service record
 */
export async function updateSignatureService(id: string, data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/${{id}}/`, {
    method: 'PUT',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update signature-service {id}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Custom action: hashDocument
 */
export async function hashDocument(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/hashDocument/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to execute hashDocument: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Custom action: hashDocumentReference
 */
export async function hashDocumentReference(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/hashDocumentReference/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to execute hashDocumentReference: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Custom action: signDocument
 */
export async function signDocument(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/signDocument/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to execute signDocument: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Custom action: signDocumentWithKey
 */
export async function signDocumentWithKey(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/signDocumentWithKey/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to execute signDocumentWithKey: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Custom action: getDocumentSignatures
 */
export async function getDocumentSignatures(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/getDocumentSignatures/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to execute getDocumentSignatures: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Custom action: rejectSignature
 */
export async function rejectSignature(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/rejectSignature/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to execute rejectSignature: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Custom action: createSignatureRequest
 */
export async function createSignatureRequest(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/createSignatureRequest/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to execute createSignatureRequest: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Custom action: getUserSignatureRequests
 */
export async function getUserSignatureRequests(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/getUserSignatureRequests/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to execute getUserSignatureRequests: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Custom action: completeSignatureRequestStep
 */
export async function completeSignatureRequestStep(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/completeSignatureRequestStep/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to execute completeSignatureRequestStep: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Custom action: cancelSignatureRequest
 */
export async function cancelSignatureRequest(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/cancelSignatureRequest/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to execute cancelSignatureRequest: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Custom action: expireOverdueSignatureRequests
 */
export async function expireOverdueSignatureRequests(data: any) {
  const client = await getApiClient();
  
  const response = await fetch(`${API_URL}/api/documents/signature-service/expireOverdueSignatureRequests/`, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to execute expireOverdueSignatureRequests: ${response.statusText}`);
  }
  
  return response.json();
}
