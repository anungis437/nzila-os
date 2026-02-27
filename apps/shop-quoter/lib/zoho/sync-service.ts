/**
 * Zoho Sync Service
 *
 * Handles bi-directional sync between nzila commerce tables and Zoho modules.
 * Includes conflict detection, field mapping, and sync state tracking.
 *
 * Ported from legacy shop_quoter_tool_v1 zoho-crm-integration.ts.
 */

import { and, eq, isNull, gte } from 'drizzle-orm'
import { db } from '@nzila/db'
import {
  commerceCustomers,
  commerceQuotes,
  commerceZohoSyncConfigs,
  commerceZohoSyncRecords,
  commerceZohoConflicts,
} from '@nzila/db/commerce'
import { logger } from '../logger'
import { ZohoCrmClient } from './crm-client'
import type { ZohoContact, ZohoDeal, SyncResult, SyncConflict } from './types'
import { ZOHO_MODULE_MAPPING } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SyncDirection = 'nzila_to_zoho' | 'zoho_to_nzila' | 'bidirectional'
export type SyncModule = 'contacts' | 'deals'

export interface SyncOptions {
  direction?: SyncDirection
  fullSync?: boolean
  dryRun?: boolean
  conflictResolution?: 'local_wins' | 'remote_wins' | 'manual'
}

// For future use in incremental sync tracking
interface _SyncRecord {
  localId: string
  remoteId: string | null
  localUpdatedAt: Date
  remoteUpdatedAt: Date | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Field Mapping: commerce_customers <-> Zoho Contacts
// ─────────────────────────────────────────────────────────────────────────────

function mapCustomerToZohoContact(customer: typeof commerceCustomers.$inferSelect): Partial<ZohoContact> {
  const [firstName, ...lastNameParts] = (customer.displayName ?? '').split(' ')
  return {
    First_Name: firstName || 'Unknown',
    Last_Name: lastNameParts.join(' ') || 'Customer',
    Email: customer.email ?? undefined,
    Phone: customer.phone ?? undefined,
    Mailing_Street: customer.address ?? undefined,
    Mailing_City: customer.city ?? undefined,
    Mailing_State: customer.province ?? undefined,
    Mailing_Zip: customer.postalCode ?? undefined,
  }
}

function mapZohoContactToCustomer(contact: ZohoContact): Partial<typeof commerceCustomers.$inferInsert> {
  const displayName = [contact.First_Name, contact.Last_Name].filter(Boolean).join(' ')
  return {
    displayName,
    email: contact.Email ?? null,
    phone: contact.Phone ?? null,
    address: contact.Mailing_Street ?? null,
    city: contact.Mailing_City ?? null,
    province: contact.Mailing_State ?? null,
    postalCode: contact.Mailing_Zip ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Field Mapping: commerce_quotes <-> Zoho Deals
// ─────────────────────────────────────────────────────────────────────────────

const QUOTE_STATUS_TO_DEAL_STAGE: Record<string, string> = {
  draft: 'Qualification',
  sent: 'Proposal/Price Quote',
  accepted: 'Closed Won',
  declined: 'Closed Lost',
  expired: 'Closed Lost',
}

// Prepared for Deal sync - to be used in syncDeals()
function _mapQuoteToZohoDeal(
  quote: typeof commerceQuotes.$inferSelect,
  contactId?: string,
): Partial<ZohoDeal> {
  return {
    Deal_Name: quote.title ?? `Quote ${quote.quoteNumber}`,
    Amount: quote.total ? Number(quote.total) : undefined,
    Stage: QUOTE_STATUS_TO_DEAL_STAGE[quote.status ?? 'draft'] ?? 'Qualification',
    Contact_Name: contactId ? { id: contactId } : undefined,
    Description: (quote.notes ?? []).join('\n'),
    Closing_Date: quote.expiresAt?.toISOString().split('T')[0],
  }
}

// Prepared for Deal sync - to be used in syncDeals()
function _mapZohoDealToQuote(deal: ZohoDeal): Partial<typeof commerceQuotes.$inferInsert> {
  // Reverse map stage to status
  const statusEntry = Object.entries(QUOTE_STATUS_TO_DEAL_STAGE).find(
    ([_, stage]) => stage === deal.Stage,
  )
  const status = statusEntry?.[0] ?? 'draft'

  return {
    title: deal.Deal_Name,
    total: deal.Amount?.toString() ?? '0',
    status: status as 'draft' | 'sent' | 'accepted' | 'declined' | 'expired',
    notes: deal.Description ? [deal.Description] : [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Zoho Sync Service
// ─────────────────────────────────────────────────────────────────────────────

export class ZohoSyncService {
  private crmClient: ZohoCrmClient
  private entityId: string

  constructor(crmClient: ZohoCrmClient, entityId: string) {
    this.crmClient = crmClient
    this.entityId = entityId
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Sync Config Management
  // ───────────────────────────────────────────────────────────────────────────

  async getSyncConfig(module: SyncModule) {
    const zohoModule = ZOHO_MODULE_MAPPING[`commerce_${module === 'contacts' ? 'customers' : 'quotes'}`]
    const [config] = await db
      .select()
      .from(commerceZohoSyncConfigs)
      .where(
        and(
          eq(commerceZohoSyncConfigs.entityId, this.entityId),
          eq(commerceZohoSyncConfigs.zohoModule, zohoModule),
        ),
      )
      .limit(1)
    return config
  }

  async createOrUpdateSyncConfig(
    module: SyncModule,
    options: {
      direction?: 'bidirectional' | 'to_zoho' | 'from_zoho'
      isActive?: boolean
      fieldMappings?: Array<{ nzilaField: string; zohoField: string; required?: boolean }>
    },
  ) {
    const zohoModule = ZOHO_MODULE_MAPPING[`commerce_${module === 'contacts' ? 'customers' : 'quotes'}`]
    const nzilaTable = module === 'contacts' ? 'commerce_customers' : 'commerce_quotes'

    await db
      .insert(commerceZohoSyncConfigs)
      .values({
        entityId: this.entityId,
        name: `${module} sync`,
        zohoModule,
        nzilaTable,
        syncDirection: options.direction ?? 'bidirectional',
        isActive: options.isActive ?? true,
        fieldMappings: options.fieldMappings ?? [],
      })
      .onConflictDoUpdate({
        target: [commerceZohoSyncConfigs.entityId, commerceZohoSyncConfigs.zohoModule],
        set: {
          syncDirection: options.direction,
          isActive: options.isActive,
          fieldMappings: options.fieldMappings,
          updatedAt: new Date(),
        },
      })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Contact Sync
  // ───────────────────────────────────────────────────────────────────────────

  async syncContacts(options: SyncOptions = {}): Promise<SyncResult> {
    const { direction = 'bidirectional', dryRun = false } = options
    const result: SyncResult = {
      module: 'contacts',
      direction,
      created: 0,
      updated: 0,
      skipped: 0,
      conflicts: [],
      errors: [],
    }

    const config = await this.getSyncConfig('contacts')
    if (!config?.isActive) {
      logger.info({ entityId: this.entityId }, 'Contact sync disabled, skipping')
      return result
    }

    const lastSync = await this.getLastSuccessfulSync('contacts')

    try {
      if (direction === 'nzila_to_zoho' || direction === 'bidirectional') {
        const localResult = await this.pushContactsToZoho(lastSync, dryRun)
        result.created += localResult.created
        result.updated += localResult.updated
        result.skipped += localResult.skipped
        result.conflicts.push(...localResult.conflicts)
      }

      if (direction === 'zoho_to_nzila' || direction === 'bidirectional') {
        const remoteResult = await this.pullContactsFromZoho(lastSync, dryRun)
        result.created += remoteResult.created
        result.updated += remoteResult.updated
        result.skipped += remoteResult.skipped
        result.conflicts.push(...remoteResult.conflicts)
      }

      if (!dryRun) {
        await this.recordSyncRun('contacts', 'success', result)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error'
      result.errors.push({ code: 'SYNC_ERROR', message })
      if (!dryRun) {
        await this.recordSyncRun('contacts', 'failed', result, message)
      }
    }

    return result
  }

  private async pushContactsToZoho(
    lastSync: Date | null,
    dryRun: boolean,
  ): Promise<SyncResult> {
    const result: SyncResult = {
      module: 'contacts',
      direction: 'nzila_to_zoho',
      created: 0,
      updated: 0,
      skipped: 0,
      conflicts: [],
      errors: [],
    }

    // Get customers modified since last sync
    const whereConditions = [eq(commerceCustomers.entityId, this.entityId)]
    if (lastSync) {
      whereConditions.push(gte(commerceCustomers.updatedAt, lastSync))
    }

    const customers = await db
      .select()
      .from(commerceCustomers)
      .where(and(...whereConditions))

    logger.info(
      { count: customers.length, entityId: this.entityId },
      'Pushing customers to Zoho',
    )

    for (const customer of customers) {
      try {
        const zohoContactId = await this.getZohoIdForLocal('contacts', customer.id)
        const contactData = mapCustomerToZohoContact(customer)

        if (dryRun) {
          if (zohoContactId) {
            result.updated++
          } else {
            result.created++
          }
          continue
        }

        if (zohoContactId) {
          await this.crmClient.updateContact(zohoContactId, contactData)
          result.updated++
        } else {
          const newContact = await this.crmClient.createContact(contactData)
          await this.linkRecords('contacts', customer.id, newContact.id)
          result.created++
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        result.errors.push({
          code: 'PUSH_ERROR',
          message: `Failed to push customer ${customer.id}: ${message}`,
        })
      }
    }

    return result
  }

  private async pullContactsFromZoho(
    lastSync: Date | null,
    dryRun: boolean,
  ): Promise<SyncResult> {
    const result: SyncResult = {
      module: 'contacts',
      direction: 'zoho_to_nzila',
      created: 0,
      updated: 0,
      skipped: 0,
      conflicts: [],
      errors: [],
    }

    // Fetch contacts from Zoho (with pagination)
    let page = 1
    const perPage = 200
    let hasMore = true

    while (hasMore) {
      const response = await this.crmClient.getContacts(page, perPage)
      const contacts = response.data ?? []

      if (contacts.length < perPage) {
        hasMore = false
      }

      for (const contact of contacts) {
        // Skip if modified before last sync
        if (lastSync && contact.Modified_Time) {
          const modifiedTime = new Date(contact.Modified_Time)
          if (modifiedTime < lastSync) {
            result.skipped++
            continue
          }
        }

        try {
          const localId = await this.getLocalIdForZoho('contacts', contact.id)
          const customerData = mapZohoContactToCustomer(contact)

          if (dryRun) {
            if (localId) {
              result.updated++
            } else {
              result.created++
            }
            continue
          }

          if (localId) {
            // Check for conflicts
            const [existingCustomer] = await db
              .select()
              .from(commerceCustomers)
              .where(eq(commerceCustomers.id, localId))
              .limit(1)

            if (existingCustomer && contact.Modified_Time) {
              const remoteModified = new Date(contact.Modified_Time)
              if (existingCustomer.updatedAt && existingCustomer.updatedAt > remoteModified) {
                // Local is newer - conflict
                const conflict: SyncConflict = {
                  id: crypto.randomUUID(),
                  entityId: this.entityId,
                  localTable: 'commerce_customers',
                  localRecordId: localId,
                  zohoModule: 'Contacts',
                  zohoRecordId: contact.id,
                  conflictType: 'update_conflict',
                  localData: existingCustomer,
                  remoteData: contact,
                  detectedAt: new Date(),
                }
                result.conflicts.push(conflict)
                await this.recordConflict(conflict)
                continue
              }
            }

            await db
              .update(commerceCustomers)
              .set({ ...customerData, updatedAt: new Date() })
              .where(eq(commerceCustomers.id, localId))
            result.updated++
          } else {
            // Create new customer
            const [newCustomer] = await db
              .insert(commerceCustomers)
              .values({
                ...customerData,
                entityId: this.entityId,
              })
              .returning()
            await this.linkRecords('contacts', newCustomer.id, contact.id)
            result.created++
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          result.errors.push({
            code: 'PULL_ERROR',
            message: `Failed to pull contact ${contact.id}: ${message}`,
          })
        }
      }

      page++
    }

    return result
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Sync Record Management
  //
  // Note: The schema uses configId-based sync records. For simplicity, we track
  // linked records by storing zoho IDs in the local records themselves
  // (zohoContactId on customers, zohoItemId on products, etc.)
  // ───────────────────────────────────────────────────────────────────────────

  private async getZohoIdForLocal(_module: SyncModule, localId: string): Promise<string | null> {
    // For customers, check the metadata or a dedicated column
    // This is a simplified implementation - in production, we'd use the sync records table
    const [customer] = await db
      .select({ metadata: commerceCustomers.metadata })
      .from(commerceCustomers)
      .where(eq(commerceCustomers.id, localId))
      .limit(1)
    const metadata = customer?.metadata as { zohoContactId?: string } | null
    return metadata?.zohoContactId ?? null
  }

  private async getLocalIdForZoho(_module: SyncModule, zohoId: string): Promise<string | null> {
    // Search for a customer with this zohoContactId in metadata
    const customers = await db
      .select({ id: commerceCustomers.id, metadata: commerceCustomers.metadata })
      .from(commerceCustomers)
      .where(eq(commerceCustomers.entityId, this.entityId))

    for (const c of customers) {
      const metadata = c.metadata as { zohoContactId?: string } | null
      if (metadata?.zohoContactId === zohoId) {
        return c.id
      }
    }
    return null
  }

  private async linkRecords(_module: SyncModule, localId: string, zohoId: string): Promise<void> {
    // Store the zoho ID in the customer's metadata
    const [customer] = await db
      .select({ metadata: commerceCustomers.metadata })
      .from(commerceCustomers)
      .where(eq(commerceCustomers.id, localId))
      .limit(1)

    const existingMetadata = (customer?.metadata ?? {}) as Record<string, unknown>
    await db
      .update(commerceCustomers)
      .set({
        metadata: { ...existingMetadata, zohoContactId: zohoId },
        updatedAt: new Date(),
      })
      .where(eq(commerceCustomers.id, localId))
  }

  private async getLastSuccessfulSync(module: SyncModule): Promise<Date | null> {
    const config = await this.getSyncConfig(module)
    return config?.lastSyncAt ?? null
  }

  private async recordSyncRun(
    module: SyncModule,
    status: 'success' | 'failed',
    result: SyncResult,
    errorMessage?: string,
  ): Promise<void> {
    // Update the config's lastSyncAt
    if (status === 'success') {
      const config = await this.getSyncConfig(module)
      if (config) {
        await db
          .update(commerceZohoSyncConfigs)
          .set({ lastSyncAt: new Date(), updatedAt: new Date() })
          .where(eq(commerceZohoSyncConfigs.id, config.id))
      }
    }

    logger.info(
      {
        entityId: this.entityId,
        module,
        status,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        conflicts: result.conflicts.length,
        errors: result.errors.length,
        errorMessage,
      },
      'Sync run completed',
    )
  }

  private async recordConflict(conflict: SyncConflict): Promise<void> {
    // Get or create a sync record first
    const config = await this.getSyncConfig('contacts')
    if (!config) {
      logger.warn({ entityId: this.entityId }, 'No sync config found for conflict recording')
      return
    }

    // Create sync record for the conflict
    const [syncRecord] = await db
      .insert(commerceZohoSyncRecords)
      .values({
        entityId: this.entityId,
        configId: config.id,
        nzilaRecordId: conflict.localRecordId,
        zohoRecordId: conflict.zohoRecordId,
        syncDirection: 'from_zoho',
        status: 'conflict',
      })
      .returning()

    // Record the conflict
    await db.insert(commerceZohoConflicts).values({
      entityId: conflict.entityId,
      syncRecordId: syncRecord.id,
      nzilaData: conflict.localData,
      zohoData: conflict.remoteData,
      conflictFields: ['updatedAt'], // simplified - would detect actual fields in production
    })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Conflict Resolution
  // ───────────────────────────────────────────────────────────────────────────

  async getUnresolvedConflicts(): Promise<SyncConflict[]> {
    const conflicts = await db
      .select({
        conflict: commerceZohoConflicts,
        syncRecord: commerceZohoSyncRecords,
      })
      .from(commerceZohoConflicts)
      .innerJoin(
        commerceZohoSyncRecords,
        eq(commerceZohoConflicts.syncRecordId, commerceZohoSyncRecords.id),
      )
      .where(
        and(
          eq(commerceZohoConflicts.entityId, this.entityId),
          isNull(commerceZohoConflicts.resolvedAt),
        ),
      )

    return conflicts.map(({ conflict, syncRecord }) => ({
      id: conflict.id,
      entityId: conflict.entityId,
      localTable: 'commerce_customers', // TODO: derive from config
      localRecordId: syncRecord.nzilaRecordId,
      zohoModule: 'Contacts',
      zohoRecordId: syncRecord.zohoRecordId ?? '',
      conflictType: 'update_conflict' as const,
      localData: conflict.nzilaData,
      remoteData: conflict.zohoData,
      detectedAt: conflict.createdAt,
    }))
  }

  async resolveConflict(
    conflictId: string,
    resolution: 'local_wins' | 'remote_wins',
  ): Promise<void> {
    // Get conflict with its sync record
    const [result] = await db
      .select({
        conflict: commerceZohoConflicts,
        syncRecord: commerceZohoSyncRecords,
      })
      .from(commerceZohoConflicts)
      .innerJoin(
        commerceZohoSyncRecords,
        eq(commerceZohoConflicts.syncRecordId, commerceZohoSyncRecords.id),
      )
      .where(eq(commerceZohoConflicts.id, conflictId))
      .limit(1)

    if (!result) {
      throw new Error(`Conflict ${conflictId} not found`)
    }

    const { conflict, syncRecord } = result
    const zohoResolution = resolution === 'local_wins' ? 'nzila_wins' : 'zoho_wins'

    if (resolution === 'local_wins') {
      // Push local data to Zoho
      if (syncRecord.zohoRecordId) {
        await this.crmClient.updateContact(
          syncRecord.zohoRecordId,
          mapCustomerToZohoContact(conflict.nzilaData as typeof commerceCustomers.$inferSelect),
        )
      }
    } else {
      // Apply remote data locally
      const customerData = mapZohoContactToCustomer(conflict.zohoData as ZohoContact)
      await db
        .update(commerceCustomers)
        .set({ ...customerData, updatedAt: new Date() })
        .where(eq(commerceCustomers.id, syncRecord.nzilaRecordId))
    }

    await db
      .update(commerceZohoConflicts)
      .set({
        resolvedAt: new Date(),
        resolution: zohoResolution,
        resolvedData: resolution === 'local_wins' ? conflict.nzilaData : conflict.zohoData,
      })
      .where(eq(commerceZohoConflicts.id, conflictId))
  }
}
