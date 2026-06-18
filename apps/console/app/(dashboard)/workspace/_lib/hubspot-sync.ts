/**
 * Console workspace — HubSpot CRM sync for the Sales pipeline.
 *
 * The Sales workspace `deals` table is the system of record; HubSpot is mirrored
 * bidirectionally:
 *  - PUSH: on create/update, the deal (and its primary contact) is upserted into
 *    HubSpot. The resulting HubSpot ids are stored in `deals.metadata.hubspot`.
 *  - PULL: `pullHubspotDeals()` imports HubSpot deals into the local table,
 *    keyed by the stored HubSpot deal id (insert when new, update when known).
 *
 * Configuration is via `HUBSPOT_API_KEY`. When unset the sync is a no-op so the
 * console runs identically without CRM credentials — never throws, never blocks
 * the local mutation. Stage vocabulary maps the partner-deal enum onto HubSpot's
 * default sales pipeline stages.
 */
import 'server-only'
import { eq } from 'drizzle-orm'
import { HubSpotClient, type HubSpotDealRecord } from '@nzila/crm-hubspot'
import { platformDb } from '@nzila/db/platform'
import { deals as dealsTable } from '@nzila/db/schema'
import { getDecryptedProviderSecrets } from '@/lib/integrations-connections'
import { getHousePartnerId } from './house-partner'
import { PARTNER_STAGES, type PartnerStage } from './sales'

/* ── Configuration ─────────────────────────────────────────────────────────── */

/**
 * Whether HubSpot credentials are available for the workspace org.
 * Uses org-scoped integration secrets first; falls back to env for local/dev.
 */
export async function isHubspotConfigured(orgId: string | null): Promise<boolean> {
  if (orgId) {
    try {
      const secrets = await getDecryptedProviderSecrets(orgId, 'hubspot')
      if (secrets?.apiKey) return true
    } catch {
      // Ignore store lookup errors and fall back to env config.
    }
  }

  return Boolean(process.env.HUBSPOT_API_KEY)
}

async function getClient(orgId: string | null): Promise<HubSpotClient | null> {
  let apiKey = process.env.HUBSPOT_API_KEY

  if (orgId) {
    try {
      const secrets = await getDecryptedProviderSecrets(orgId, 'hubspot')
      if (secrets?.apiKey) apiKey = secrets.apiKey
    } catch {
      // Ignore store lookup errors and fall back to env config.
    }
  }

  if (!apiKey) return null
  return new HubSpotClient({ apiKey })
}

/* ── Stage mapping (partner enum ⇄ HubSpot default pipeline) ─────────────────── */

const PARTNER_STAGE_TO_HUBSPOT: Record<PartnerStage, string> = {
  registered: 'qualifiedtobuy',
  submitted: 'presentationscheduled',
  approved: 'contractsent',
  won: 'closedwon',
  lost: 'closedlost',
}

const HUBSPOT_STAGE_TO_PARTNER: Record<string, PartnerStage> = {
  appointmentscheduled: 'registered',
  qualifiedtobuy: 'registered',
  presentationscheduled: 'submitted',
  decisionmakerboughtin: 'submitted',
  contractsent: 'approved',
  closedwon: 'won',
  closedlost: 'lost',
}

function toHubspotStage(stage: PartnerStage): string {
  return PARTNER_STAGE_TO_HUBSPOT[stage] ?? 'qualifiedtobuy'
}

function toPartnerStage(hubspotStage: string | null | undefined): PartnerStage {
  if (!hubspotStage) return 'registered'
  return HUBSPOT_STAGE_TO_PARTNER[hubspotStage] ?? 'registered'
}

/* ── Metadata helpers (HubSpot link stored on deals.metadata) ───────────────── */

interface HubspotMeta {
  dealId?: string
  contactId?: string
  lastSyncedAt?: string
  direction?: 'push' | 'pull'
}

function readHubspotMeta(metadata: unknown): HubspotMeta {
  if (metadata && typeof metadata === 'object' && 'hubspot' in metadata) {
    const hs = (metadata as { hubspot?: unknown }).hubspot
    if (hs && typeof hs === 'object') return hs as HubspotMeta
  }
  return {}
}

function writeHubspotMeta(metadata: unknown, hubspot: HubspotMeta): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {}
  return { ...base, hubspot }
}

/* ── Push: local deal → HubSpot ─────────────────────────────────────────────── */

export interface PushDealInput {
  id: string
  accountName: string
  contactName: string
  contactEmail: string
  estimatedArr: number
  stage: PartnerStage
  expectedCloseDate: string | null
  metadata: unknown
}

/**
 * Upsert a deal (and its primary contact) into HubSpot and persist the returned
 * HubSpot ids onto the local row's metadata. Best-effort: returns false and
 * never throws when HubSpot is unconfigured or the API call fails.
 */
export async function pushDealToHubspot(input: PushDealInput, orgId: string | null): Promise<boolean> {
  const client = await getClient(orgId)
  if (!client) return false

  try {
    const existing = readHubspotMeta(input.metadata)

    // 1. Upsert the contact (HubSpot dedupes on email).
    let contactId = existing.contactId
    if (input.contactEmail) {
      const [firstName, ...rest] = input.contactName.trim().split(/\s+/)
      const contactResult = await client.upsertContact({
        email: input.contactEmail,
        firstName: firstName || undefined,
        lastName: rest.join(' ') || undefined,
        company: input.accountName || undefined,
      })
      if (contactResult.ok) contactId = contactResult.id
    }

    // 2. Create or update the deal.
    let dealId = existing.dealId
    const stage = toHubspotStage(input.stage)
    if (dealId) {
      const updateResult = await client.updateDeal(dealId, {
        name: input.accountName,
        stage,
        amount: input.estimatedArr,
        closeDate: input.expectedCloseDate,
      })
      if (!updateResult.ok) return false
    } else {
      const createResult = await client.createDeal({
        name: input.accountName,
        stage,
        amount: input.estimatedArr,
        contactId,
        ...(input.expectedCloseDate ? { properties: { closedate: input.expectedCloseDate } } : {}),
      })
      if (!createResult.ok) return false
      dealId = createResult.id
    }

    // 3. Persist the HubSpot link onto the local row.
    await platformDb
      .update(dealsTable)
      .set({
        metadata: writeHubspotMeta(input.metadata, {
          dealId,
          contactId,
          lastSyncedAt: new Date().toISOString(),
          direction: 'push',
        }),
      })
      .where(eq(dealsTable.id, input.id))

    return true
  } catch {
    // CRM unreachable — never block the local mutation.
    return false
  }
}

/* ── Pull: HubSpot → local deals ────────────────────────────────────────────── */

export interface PullSummary {
  configured: boolean
  imported: number
  updated: number
  scanned: number
  error: string | null
}

/** Resolve account/contact display fields from a HubSpot deal + its contact. */
async function resolveDealFields(
  client: HubSpotClient,
  record: HubSpotDealRecord,
): Promise<{ accountName: string; contactName: string; contactEmail: string }> {
  const accountName = record.properties.dealname?.trim() || `HubSpot deal ${record.id}`
  let contactName = ''
  let contactEmail = ''

  const contactId = record.associations?.contacts?.results?.[0]?.id
  if (contactId) {
    const contactResult = await client.getContact(contactId)
    if (contactResult.ok) {
      const p = contactResult.contact.properties
      contactName = [p.firstname, p.lastname].filter(Boolean).join(' ').trim()
      contactEmail = p.email?.trim() ?? ''
    }
  }

  return {
    accountName,
    contactName: contactName || accountName,
    contactEmail: contactEmail || 'unknown@hubspot.import',
  }
}

/**
 * Import deals from HubSpot into the local `deals` table. Rows already linked by
 * HubSpot deal id are updated in place; unknown HubSpot deals are inserted and
 * attached to the internal house partner. Never throws.
 */
export async function pullHubspotDeals(opts?: { maxPages?: number; orgId?: string | null }): Promise<PullSummary> {
  const client = await getClient(opts?.orgId ?? null)
  if (!client) {
    return { configured: false, imported: 0, updated: 0, scanned: 0, error: null }
  }

  let imported = 0
  let updated = 0
  let scanned = 0

  try {
    // Index existing local rows by their stored HubSpot deal id.
    const localRows = await platformDb
      .select({ id: dealsTable.id, metadata: dealsTable.metadata })
      .from(dealsTable)
    const byHubspotId = new Map<string, string>()
    for (const row of localRows) {
      const meta = readHubspotMeta(row.metadata)
      if (meta.dealId) byHubspotId.set(meta.dealId, row.id)
    }

    const partnerId = await getHousePartnerId()
    const maxPages = opts?.maxPages ?? 10
    let after: string | null = null

    for (let page = 0; page < maxPages; page++) {
      const result: Awaited<ReturnType<HubSpotClient['listDeals']>> = await client.listDeals(
        after ? { after } : undefined,
      )
      if (!result.ok) {
        return { configured: true, imported, updated, scanned, error: result.error }
      }

      for (const record of result.deals) {
        scanned += 1
        const stage = toPartnerStage(record.properties.dealstage)
        const arr = Number(record.properties.amount)
        const estimatedArr = (Number.isFinite(arr) && arr > 0 ? arr : 0).toFixed(2)
        const closeDate = record.properties.closedate
          ? record.properties.closedate.slice(0, 10)
          : null

        const localId = byHubspotId.get(record.id)
        if (localId) {
          await platformDb
            .update(dealsTable)
            .set({
              stage,
              estimatedArr,
              expectedCloseDate: closeDate,
              updatedAt: new Date(),
            })
            .where(eq(dealsTable.id, localId))
          updated += 1
        } else {
          const fields = await resolveDealFields(client, record)
          await platformDb.insert(dealsTable).values({
            partnerId,
            accountName: fields.accountName,
            contactName: fields.contactName,
            contactEmail: fields.contactEmail,
            vertical: 'platform',
            estimatedArr,
            stage,
            expectedCloseDate: closeDate,
            metadata: writeHubspotMeta(null, {
              dealId: record.id,
              contactId: record.associations?.contacts?.results?.[0]?.id,
              lastSyncedAt: new Date().toISOString(),
              direction: 'pull',
            }),
          })
          imported += 1
        }
      }

      after = result.after
      if (!after) break
    }

    return { configured: true, imported, updated, scanned, error: null }
  } catch (err) {
    return {
      configured: true,
      imported,
      updated,
      scanned,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Build the push input from a freshly-read local deal row. */
export function toPushInput(row: typeof dealsTable.$inferSelect): PushDealInput {
  const stage = (PARTNER_STAGES as readonly string[]).includes(row.stage)
    ? (row.stage as PartnerStage)
    : 'registered'
  return {
    id: row.id,
    accountName: row.accountName,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    estimatedArr: Number(row.estimatedArr) || 0,
    stage,
    expectedCloseDate: row.expectedCloseDate ?? null,
    metadata: row.metadata,
  }
}
