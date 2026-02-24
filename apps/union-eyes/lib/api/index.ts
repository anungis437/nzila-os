/**
 * Internal API Interface
 * 
 * Simplified API client for Next.js internal API routes
 * Used by client components to communicate with backend
 */

const logger = { error: console.error };

interface _RequestOptions {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
}

/**
 * Base fetch wrapper with error handling
 */
async function fetchAPI<T>(
  endpoint: string,
  init?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(endpoint, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    logger.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * Build URL with query parameters
 */
function buildURL(
  base: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  if (!params) return base;

  const query = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  return query ? `${base}?${query}` : base;
}

// ============================================================================
// MEMBERS API
// ============================================================================

export const membersAPI = {
  list: (params?: {
    search?: string;
    status?: string;
    local?: string;
    limit?: number;
    offset?: number;
  }) => fetchAPI<{ members: unknown[]; total: number }>(buildURL('/api/members', params)),

  get: (id: string) => fetchAPI<unknown>(`/api/members/${id}`),

  create: (data: unknown) =>
    fetchAPI<unknown>('/api/members', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: unknown) =>
    fetchAPI<unknown>(`/api/members/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchAPI<void>(`/api/members/${id}`, {
      method: 'DELETE',
    }),

  search: (query: string) =>
    fetchAPI<{ members: unknown[] }>('/api/members/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  import: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/members/import', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Import failed');
    return response.json();
  },
};

export const memberSegmentsAPI = {
  list: () => fetchAPI<unknown[]>('/api/members/segments'),

  create: (data: unknown) =>
    fetchAPI<unknown>('/api/members/segments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  preview: (filters: unknown[]) =>
    fetchAPI<{ count: number }>('/api/members/segments/preview', {
      method: 'POST',
      body: JSON.stringify({ filters }),
    }),

  delete: (id: string) =>
    fetchAPI<void>(`/api/members/segments/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================================================
// DUES API
// ============================================================================

export const duesAPI = {
  dashboard: () => fetchAPI<unknown>('/api/dues/dashboard'),

  remittances: {
    list: (params?: { employer?: string; status?: string; limit?: number }) =>
      fetchAPI<unknown[]>(buildURL('/api/dues/remittances', params)),

    upload: async (file: File, metadata: unknown) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify(metadata));
      const response = await fetch('/api/dues/remittances/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
  },

  reconciliation: {
    queue: () => fetchAPI<unknown[]>('/api/dues/reconciliation/queue'),

    autoMatch: () =>
      fetchAPI<{ matched: number }>('/api/dues/reconciliation/auto-match', {
        method: 'POST',
      }),

    match: (remittanceId: string, memberId: string) =>
      fetchAPI<void>('/api/dues/reconciliation/match', {
        method: 'POST',
        body: JSON.stringify({ remittanceId, memberId }),
      }),

    reject: (remittanceId: string, reason: string) =>
      fetchAPI<void>('/api/dues/reconciliation/reject', {
        method: 'POST',
        body: JSON.stringify({ remittanceId, reason }),
      }),
  },

  arrears: {
    list: () => fetchAPI<unknown[]>('/api/dues/arrears'),

    recordPayment: (memberId: string, amount: number, notes?: string) =>
      fetchAPI<unknown>(`/api/dues/arrears/${memberId}/payment`, {
        method: 'POST',
        body: JSON.stringify({ amount, notes }),
      }),

    sendReminder: (memberId: string) =>
      fetchAPI<{ sent: boolean }>(`/api/dues/arrears/${memberId}/reminder`, {
        method: 'POST',
      }),
  },

  paymentPlans: {
    list: () => fetchAPI<unknown[]>('/api/dues/payment-plans'),

    get: (id: string) => fetchAPI<unknown>(`/api/dues/payment-plans/${id}`),

    create: (data: unknown) =>
      fetchAPI<unknown>('/api/dues/payment-plans', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: unknown) =>
      fetchAPI<unknown>(`/api/dues/payment-plans/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      fetchAPI<void>(`/api/dues/payment-plans/${id}`, {
        method: 'DELETE',
      }),
  },
};

// ============================================================================
// CASES API
// ============================================================================

export const casesAPI = {
  list: (params?: { status?: string; type?: string; priority?: string }) =>
    fetchAPI<unknown[]>(buildURL('/api/cases', params)),

  get: (id: string) => fetchAPI<unknown>(`/api/cases/${id}`),

  create: (data: unknown) =>
    fetchAPI<unknown>('/api/cases', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: unknown) =>
    fetchAPI<unknown>(`/api/cases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchAPI<void>(`/api/cases/${id}`, {
      method: 'DELETE',
    }),

  timeline: (id: string) => fetchAPI<unknown[]>(`/api/cases/${id}/timeline`),

  evidence: {
    list: (caseId: string) =>
      fetchAPI<unknown[]>(`/api/cases/${caseId}/evidence`),

    upload: async (caseId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/cases/${caseId}/evidence`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },

    delete: (caseId: string, evidenceId: string) =>
      fetchAPI<void>(`/api/cases/${caseId}/evidence/${evidenceId}`, {
        method: 'DELETE',
      }),
  },

  notes: {
    list: (caseId: string) => fetchAPI<unknown[]>(`/api/cases/${caseId}/notes`),

    create: (caseId: string, content: string) =>
      fetchAPI<unknown>(`/api/cases/${caseId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
  },
};

// ============================================================================
// STRIKE FUND API
// ============================================================================

export const strikeFundAPI = {
  dashboard: () => fetchAPI<unknown>('/api/strike-fund/dashboard'),

  applications: {
    list: (params?: { status?: string }) =>
      fetchAPI<unknown[]>(buildURL('/api/strike-fund/applications', params)),

    get: (id: string) =>
      fetchAPI<unknown>(`/api/strike-fund/applications/${id}`),

    create: (data: unknown) =>
      fetchAPI<unknown>('/api/strike-fund/applications', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    approve: (id: string) =>
      fetchAPI<void>(`/api/strike-fund/applications/${id}/approve`, {
        method: 'POST',
      }),

    reject: (id: string, reason: string) =>
      fetchAPI<void>(`/api/strike-fund/applications/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },
};

// ============================================================================
// ELECTIONS API
// ============================================================================

export const electionsAPI = {
  list: (params?: { status?: string }) =>
    fetchAPI<unknown[]>(buildURL('/api/elections', params)),

  get: (id: string) => fetchAPI<unknown>(`/api/elections/${id}`),

  create: (data: unknown) =>
    fetchAPI<unknown>('/api/elections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: unknown) =>
    fetchAPI<unknown>(`/api/elections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  vote: (electionId: string, votes: Record<string, string[]>) =>
    fetchAPI<void>(`/api/elections/${electionId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ votes }),
    }),

  results: (id: string) =>
    fetchAPI<unknown>(`/api/elections/${id}/results`),
};

// ============================================================================
// DASHBOARD API
// ============================================================================

export const dashboardAPI = {
  stats: () => fetchAPI<unknown>('/api/dashboard/stats'),

  activities: (limit?: number) =>
    fetchAPI<unknown[]>(buildURL('/api/dashboard/activities', { limit })),
};

// ============================================================================
// ADMIN API
// ============================================================================

export const adminAPI = {
  integrations: {
    list: () => fetchAPI<unknown[]>('/api/admin/integrations'),

    test: (id: string) =>
      fetchAPI<{ success: boolean }>(`/api/admin/integrations/${id}/test`, {
        method: 'POST',
      }),

    sync: (id: string) =>
      fetchAPI<void>(`/api/admin/integrations/${id}/sync`, {
        method: 'POST',
      }),
  },

  governance: {
    policies: () => fetchAPI<unknown[]>('/api/admin/governance/policies'),

    createPolicy: (data: unknown) =>
      fetchAPI<unknown>('/api/admin/governance/policies', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  audit: {
    logs: (params?: { limit?: number; entity?: string }) =>
      fetchAPI<unknown[]>(buildURL('/api/admin/audit-logs', params)),
  },
};

// Export all APIs as a single object for convenience
export const api = {
  members: membersAPI,
  memberSegments: memberSegmentsAPI,
  dues: duesAPI,
  cases: casesAPI,
  strikeFund: strikeFundAPI,
  elections: electionsAPI,
  dashboard: dashboardAPI,
  admin: adminAPI,
};
