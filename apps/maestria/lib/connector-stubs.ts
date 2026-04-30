import { adsCampaigns, crmReminders, customerProfiles, liveConnectors, shopifyBundlePerformance, shopifyMetrics } from '@/lib/shopmoica-pilot-data'

export type ConnectorSystem = 'shopify' | 'google-ads' | 'zoho'

export interface ConnectorMetric {
  label: string
  value: string
  note: string
}

export interface ConnectorStubResponse {
  system: ConnectorSystem
  connector: {
    id: string
    name: string
    status: string
    lastSync: string
    latencyMs: number
    note: string
  }
  datasets: string[]
  metrics: ConnectorMetric[]
  endpoint: string
}

function shopifySnapshot(): ConnectorStubResponse {
  const connector = liveConnectors.find((item) => item.system === 'Shopify')!
  return {
    system: 'shopify',
    connector,
    datasets: ['orders', 'products', 'bundles', 'cart-conversion'],
    endpoint: '/api/maestria/connectors/shopify',
    metrics: shopifyMetrics.map((metric) => ({
      label: metric.label,
      value: metric.value,
      note: metric.note,
    })).concat(
      shopifyBundlePerformance.slice(0, 2).map((bundle) => ({
        label: bundle.bundleSku,
        value: `${bundle.conversionRate}% conversion`,
        note: `AOV ${bundle.aov} · repeat ${bundle.repeatRate}%`,
      })),
    ),
  }
}

function adsSnapshot(): ConnectorStubResponse {
  const connector = liveConnectors.find((item) => item.system === 'Google Ads')!
  return {
    system: 'google-ads',
    connector,
    datasets: ['campaigns', 'keywords', 'geo-performance', 'budget-pacing'],
    endpoint: '/api/maestria/connectors/google-ads',
    metrics: adsCampaigns.map((campaign) => ({
      label: campaign.campaign,
      value: `${campaign.roas.toFixed(1)}x ROAS`,
      note: `${campaign.channel} · spend ${campaign.spend} · ${campaign.conversions} conversions`,
    })),
  }
}

function zohoSnapshot(): ConnectorStubResponse {
  const connector = liveConnectors.find((item) => item.system === 'Zoho')!
  return {
    system: 'zoho',
    connector,
    datasets: ['accounts', 'vip-reminders', 'activity-owner-map', 'concierge-opportunities'],
    endpoint: '/api/maestria/connectors/zoho',
    metrics: [
      ...crmReminders.map((reminder) => ({
        label: reminder.customerName,
        value: reminder.type,
        note: `${reminder.when} · ${reminder.note}`,
      })),
      ...customerProfiles.filter((customer) => customer.vipStatus).slice(0, 2).map((customer) => ({
        label: customer.name,
        value: `${customer.preferredLanguage} service`,
        note: `${customer.segment} · next ${customer.nextOpportunity}`,
      })),
    ],
  }
}

export function getConnectorStub(system: ConnectorSystem): ConnectorStubResponse {
  switch (system) {
    case 'shopify':
      return shopifySnapshot()
    case 'google-ads':
      return adsSnapshot()
    case 'zoho':
      return zohoSnapshot()
    default:
      throw new Error(`Unsupported connector system: ${system satisfies never}`)
  }
}
