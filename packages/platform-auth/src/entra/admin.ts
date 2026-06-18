/**
 * @nzila/platform-auth — Entra Admin Client
 *
 * Admin SDK for user and organization operations via Microsoft Graph API.
 *
 * For full compatibility, set:
 *   AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID
 *
 * Usage:
 *   import { adminClient } from '@nzila/platform-auth/entra/server'
 */

// ── Graph API Helpers ───────────────────────────────────────────────────────

async function getGraphToken(): Promise<string> {
  const tenantId = process.env.AZURE_AD_TENANT_ID
  const clientId = process.env.AZURE_AD_CLIENT_ID
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing AZURE_AD_* environment variables for Graph API')
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new Error(`Graph token request failed: ${res.status} ${res.statusText}`)
  }

  const data = await res.json() as { access_token: string }
  return data.access_token
}

async function graphRequest(path: string, options: RequestInit = {}) {
  const token = await getGraphToken()
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph API ${res.status}: ${text}`)
  }

  return res.json()
}

// ── User Object Shape ───────────────────────────────────────────────────────

interface GraphUser {
  id: string
  displayName: string
  givenName: string | null
  surname: string | null
  mail: string | null
  userPrincipalName: string
}

function mapGraphUser(u: GraphUser) {
  return {
    id: u.id,
    firstName: u.givenName,
    lastName: u.surname,
    fullName: u.displayName,
    emailAddresses: u.mail ? [{ emailAddress: u.mail }] : [],
    primaryEmailAddress: u.mail ? { emailAddress: u.mail } : null,
    imageUrl: null,
    publicMetadata: {},
    privateMetadata: {},
  }
}

// ── Admin Client ───────────────────────────────────────────────────────────────

export const adminClient = {
  users: {
    async getUser(userId: string) {
      const user = await graphRequest(`/users/${userId}`) as GraphUser
      return mapGraphUser(user)
    },

    async getUserList(params?: { emailAddress?: string[]; limit?: number }) {
      let filter = ''
      if (params?.emailAddress?.length) {
        const clauses = params.emailAddress.map(
          (e) => `mail eq '${e.replace(/'/g, "''")}'`
        )
        filter = `?$filter=${clauses.join(' or ')}`
      }
      const result = await graphRequest(`/users${filter}`) as { value: GraphUser[] }
      return { data: result.value.map(mapGraphUser), totalCount: result.value.length }
    },
  },

  organizations: {
    async getOrganizationMembershipList(params: {
      organizationId: string
      limit?: number
    }) {
      // Map Clerk orgs to Entra groups
      const result = await graphRequest(
        `/groups/${params.organizationId}/members?$top=${params.limit ?? 100}`
      ) as { value: GraphUser[] }
      return {
        data: result.value.map((m) => ({
          publicUserData: { userId: m.id, identifier: m.mail ?? m.userPrincipalName },
          role: 'org:member',
        })),
        totalCount: result.value.length,
      }
    },
  },
}

/** @deprecated Use `adminClient` instead */
export const clerkClient = adminClient
