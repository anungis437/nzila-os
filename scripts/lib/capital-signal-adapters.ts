import type { CapitalProduct } from './capital-allocation'

export interface CapitalSignalSnapshot {
  product_id: string
  stripe_mrr?: number
  hubspot_weighted_pipeline?: number
  quickbooks_monthly_burn?: number
  supabase_active_users?: number
  crm_probability_of_close?: number
  github_velocity_points?: number
  source_status: 'placeholder'
  note: string
}

export interface CapitalSignalAdapter {
  name: string
  fetch(product: CapitalProduct): Promise<CapitalSignalSnapshot>
}

function placeholderSnapshot(name: string, product: CapitalProduct): CapitalSignalSnapshot {
  return {
    product_id: product.id,
    source_status: 'placeholder',
    note: `${name} adapter placeholder: live ingestion not wired yet. Replace with authenticated client and mapping.`,
  }
}

export const stripeAdapter: CapitalSignalAdapter = {
  name: 'Stripe',
  async fetch(product) {
    return placeholderSnapshot('Stripe', product)
  },
}

export const hubspotAdapter: CapitalSignalAdapter = {
  name: 'HubSpot',
  async fetch(product) {
    return placeholderSnapshot('HubSpot', product)
  },
}

export const quickBooksAdapter: CapitalSignalAdapter = {
  name: 'QuickBooks',
  async fetch(product) {
    return placeholderSnapshot('QuickBooks', product)
  },
}

export const supabaseAnalyticsAdapter: CapitalSignalAdapter = {
  name: 'SupabaseAnalytics',
  async fetch(product) {
    return placeholderSnapshot('Supabase analytics', product)
  },
}

export const crmPipelineAdapter: CapitalSignalAdapter = {
  name: 'CrmPipeline',
  async fetch(product) {
    return placeholderSnapshot('CRM pipeline', product)
  },
}

export const githubVelocityAdapter: CapitalSignalAdapter = {
  name: 'GitHubVelocity',
  async fetch(product) {
    return placeholderSnapshot('GitHub velocity', product)
  },
}

export async function getCapitalSignalPlaceholders(product: CapitalProduct): Promise<CapitalSignalSnapshot[]> {
  return Promise.all([
    stripeAdapter.fetch(product),
    hubspotAdapter.fetch(product),
    quickBooksAdapter.fetch(product),
    supabaseAnalyticsAdapter.fetch(product),
    crmPipelineAdapter.fetch(product),
    githubVelocityAdapter.fetch(product),
  ])
}