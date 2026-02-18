/**
 * Nzila Business OS - Share Register
 * 
 * Manages the official share register, cap table, and equity transactions.
 * This is the core of EquityOS.
 */

import { z } from 'zod'
import {
  Shareholder,
  ShareholderSchema,
  ShareHolding,
  ShareHoldingSchema,
  ShareLedgerEntry,
  ShareLedgerEntrySchema,
  CapTableSnapshot,
  CapTableSnapshotSchema,
  ShareClass,
  ShareholderType,
  EquityTransactionType,
  CONSTITUTIONAL_THRESHOLDS,
  calculatePercentage,
} from '../equity/models'

// ============================================================================
// IN-MEMORY STORE (Replace with database in production)
// ============================================================================

// Sample data store - in production this would be a database
const shareholders: Map<string, Shareholder> = new Map()
const holdings: Map<string, ShareHolding> = new Map()
const ledger: Map<string, ShareLedgerEntry> = new Map()
const snapshots: Map<string, CapTableSnapshot> = new Map()

// Initialize with sample data
function initializeSampleData() {
  if (shareholders.size > 0) return // Already initialized

  const now = new Date().toISOString()
  
  // Sample shareholders
  const sampleShareholders: Shareholder[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      type: ShareholderType.FOUNDER,
      name: 'Jane Smith',
      email: 'jane@nzila.ventures',
      legalName: 'Jane Smith',
      jurisdiction: 'CANADA',
      address: {
        street: '123 Startup Lane',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 1A1',
        country: 'Canada',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      type: 'FOUNDER' as const,
      name: 'John Doe',
      email: 'john@nzila.ventures',
      legalName: 'John Doe',
      jurisdiction: 'CANADA',
      address: {
        street: '456 Innovation Blvd',
        city: 'Vancouver',
        province: 'BC',
        postalCode: 'V6B 1A1',
        country: 'Canada',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      type: 'CORPORATION' as const,
      name: 'Acme Ventures Fund I',
      email: 'deals@acmeventures.com',
      legalName: 'Acme Ventures Fund I, LP',
      registrationNumber: 'BC1234567',
      jurisdiction: 'CANADA',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      type: 'INDIVIDUAL' as const,
      name: 'Alice Investor',
      email: 'alice@example.com',
      jurisdiction: 'CANADA',
      createdAt: now,
      updatedAt: now,
    },
  ]
  
  sampleShareholders.forEach(s => shareholders.set(s.id, s))
  
  // Sample holdings
  const sampleHoldings: ShareHolding[] = [
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      shareholderId: '11111111-1111-1111-1111-111111111111',
      shareClass: ShareClass.FOUNDERS_F,
      sharesIssued: 1000000,
      sharesOutstanding: 1000000,
      sharesReserved: 0,
      originalIssueDate: '2024-01-15T00:00:00Z',
      originalIssuePrice: 0.001,
      consideration: 1000,
      isVested: true,
      transferRestrictions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      shareholderId: '22222222-2222-2222-2222-222222222222',
      shareClass: ShareClass.FOUNDERS_F,
      sharesIssued: 1000000,
      sharesOutstanding: 1000000,
      sharesReserved: 0,
      originalIssueDate: '2024-01-15T00:00:00Z',
      originalIssuePrice: 0.001,
      consideration: 1000,
      isVested: true,
      transferRestrictions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      shareholderId: '33333333-3333-3333-3333-333333333333',
      shareClass: ShareClass.PREFERRED_A,
      sharesIssued: 500000,
      sharesOutstanding: 500000,
      sharesReserved: 0,
      originalIssueDate: '2024-06-01T00:00:00Z',
      originalIssuePrice: 1.00,
      consideration: 500000,
      isVested: true,
      certificateNumber: 'PA-001',
      transferRestrictions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      shareholderId: '44444444-4444-4444-4444-444444444444',
      shareClass: ShareClass.COMMON_A,
      sharesIssued: 100000,
      sharesOutstanding: 100000,
      sharesReserved: 0,
      originalIssueDate: '2024-09-15T00:00:00Z',
      originalIssuePrice: 2.00,
      consideration: 200000,
      isVested: true,
      certificateNumber: 'CA-001',
      createdAt: now,
      updatedAt: now,
    },
  ]
  
  sampleHoldings.forEach(h => holdings.set(h.id, h))
}

// ============================================================================
// SHARE REGISTER SERVICE
// ============================================================================

export class ShareRegister {
  constructor() {
    initializeSampleData()
  }

  // ---------------------------------------------------------------------------
  // Shareholders
  // ---------------------------------------------------------------------------

  /**
   * Get all shareholders
   */
  getAllShareholders(): Shareholder[] {
    return Array.from(shareholders.values())
  }

  /**
   * Get shareholder by ID
   */
  getShareholder(id: string): Shareholder | undefined {
    return shareholders.get(id)
  }

  /**
   * Create new shareholder
   */
  createShareholder(data: Omit<Shareholder, 'id' | 'createdAt' | 'updatedAt'>): Shareholder {
    const now = new Date().toISOString()
    const shareholder: Shareholder = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    shareholders.set(shareholder.id, shareholder)
    return shareholder
  }

  /**
   * Update shareholder
   */
  updateShareholder(id: string, data: Partial<Shareholder>): Shareholder | undefined {
    const existing = shareholders.get(id)
    if (!existing) return undefined
    
    const updated: Shareholder = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }
    shareholders.set(id, updated)
    return updated
  }

  // ---------------------------------------------------------------------------
  // Holdings
  // ---------------------------------------------------------------------------

  /**
   * Get all holdings
   */
  getAllHoldings(): ShareHolding[] {
    return Array.from(holdings.values())
  }

  /**
   * Get holdings for a shareholder
   */
  getHoldingsForShareholder(shareholderId: string): ShareHolding[] {
    return Array.from(holdings.values()).filter(h => h.shareholderId === shareholderId)
  }

  /**
   * Get holdings by share class
   */
  getHoldingsByClass(shareClass: ShareClass): ShareHolding[] {
    return Array.from(holdings.values()).filter(h => h.shareClass === shareClass)
  }

  // ---------------------------------------------------------------------------
  // Cap Table
  // ---------------------------------------------------------------------------

  /**
   * Get current cap table
   */
  getCapTable(): {
    totalSharesAuthorized: number
    totalSharesIssued: number
    totalSharesOutstanding: number
    totalShareholders: number
    byClass: Map<ShareClass, { issued: number; outstanding: number; holders: number }>
    byHolder: Map<string, { name: string; shares: number; classes: Map<ShareClass, number> }>
  } {
    const allHoldings = this.getAllHoldings()
    
    let totalSharesIssued = 0
    let totalSharesOutstanding = 0
    const byClass = new Map<ShareClass, { issued: number; outstanding: number; holders: number }>()
    const byHolder = new Map<string, { name: string; shares: number; classes: Map<ShareClass, number> }>()
    
    // Calculate totals by class
    for (const holding of allHoldings) {
      totalSharesIssued += holding.sharesIssued
      totalSharesOutstanding += holding.sharesOutstanding
      
      const classStats = byClass.get(holding.shareClass) || {
        issued: 0,
        outstanding: 0,
        holders: 0,
      }
      classStats.issued += holding.sharesIssued
      classStats.outstanding += holding.sharesOutstanding
      byClass.set(holding.shareClass, classStats)
    }
    
    // Calculate totals by holder
    const uniqueHolders = new Set(allHoldings.map(h => h.shareholderId))
    for (const shareholderId of uniqueHolders) {
      const shareholder = shareholders.get(shareholderId)
      const holderHoldings = allHoldings.filter(h => h.shareholderId === shareholderId)
      
      let totalHolderShares = 0
      const classes = new Map<ShareClass, number>()
      
      for (const h of holderHoldings) {
        totalHolderShares += h.sharesOutstanding
        const existing = classes.get(h.shareClass) || 0
        classes.set(h.shareClass, existing + h.sharesOutstanding)
        
        // Update holder count for class
        const classStats = byClass.get(h.shareClass)!
        classStats.holders += 1
      }
      
      byHolder.set(shareholderId, {
        name: shareholder?.name || 'Unknown',
        shares: totalHolderShares,
        classes,
      })
    }
    
    return {
      totalSharesAuthorized: 10000000, // Would come from articles of incorporation
      totalSharesIssued,
      totalSharesOutstanding,
      totalShareholders: uniqueHolders.size,
      byClass,
      byHolder,
    }
  }

  /**
   * Generate cap table snapshot
   */
  generateSnapshot(notes?: string): CapTableSnapshot {
    const capTable = this.getCapTable()
    const now = new Date().toISOString()
    
    // Build breakdown by share class
    const breakdown = Array.from(capTable.byClass.entries()).map(([shareClass, stats]) => ({
      shareClass,
      sharesAuthorized: this.getAuthorizedShares(shareClass),
      sharesIssued: stats.issued,
      sharesOutstanding: stats.outstanding,
      shareholderCount: stats.holders,
      percentageOfTotal: calculatePercentage(stats.outstanding, capTable.totalSharesOutstanding),
      totalValue: 0, // Would calculate at FMV
    }))
    
    // Build ownership list
    const ownership = Array.from(capTable.byHolder.entries()).map(([holderId, holderData]) => ({
      shareholderId: holderId,
      shareholderName: holderData.name,
      totalShares: holderData.shares,
      percentage: calculatePercentage(holderData.shares, capTable.totalSharesOutstanding),
      votingPower: this.calculateVotingPower(holderId),
      classBreakdown: Object.fromEntries(holderData.classes),
    }))
    
    const snapshot: CapTableSnapshot = {
      id: crypto.randomUUID(),
      snapshotDate: now,
      totalSharesAuthorized: capTable.totalSharesAuthorized,
      totalSharesIssued: capTable.totalSharesIssued,
      totalSharesOutstanding: capTable.totalSharesOutstanding,
      totalShareholders: capTable.totalShareholders,
      breakdown,
      ownership,
      generatedAt: now,
      generatedBy: 'system',
      notes,
    }
    
    snapshots.set(snapshot.id, snapshot)
    return snapshot
  }

  /**
   * Get historical snapshots
   */
  getSnapshots(limit = 10): CapTableSnapshot[] {
    return Array.from(snapshots.values())
      .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime())
      .slice(0, limit)
  }

  // ---------------------------------------------------------------------------
  // Ledger Operations
  // ---------------------------------------------------------------------------

  /**
   * Add ledger entry (for append-only audit trail)
   */
  addLedgerEntry(entry: Omit<ShareLedgerEntry, 'id' | 'createdAt'>): ShareLedgerEntry {
    const now = new Date().toISOString()
    const ledgerEntry: ShareLedgerEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: now,
    }
    ledger.set(ledgerEntry.id, ledgerEntry)
    return ledgerEntry
  }

  /**
   * Get ledger entries
   */
  getLedgerEntries(limit = 100): ShareLedgerEntry[] {
    return Array.from(ledger.values())
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
      .slice(0, limit)
  }

  // ---------------------------------------------------------------------------
  // Equity Transactions
  // ---------------------------------------------------------------------------

  /**
   * Issue new shares
   */
  async issueShares(
    shareholderId: string,
    shareClass: ShareClass,
    shares: number,
    pricePerShare: number,
    createdBy: string
  ): Promise<{ holding: ShareHolding; ledgerEntry: ShareLedgerEntry }> {
    const now = new Date().toISOString()
    
    // Check for existing holding
    const existingHoldings = this.getHoldingsForShareholder(shareholderId)
    const existingHolding = existingHoldings.find(h => h.shareClass === shareClass)
    
    let holding: ShareHolding
    
    if (existingHolding) {
      // Update existing holding
      holding = {
        ...existingHolding,
        sharesIssued: existingHolding.sharesIssued + shares,
        sharesOutstanding: existingHolding.sharesOutstanding + shares,
        updatedAt: now,
      }
      holdings.set(holding.id, holding)
    } else {
      // Create new holding
      holding = {
        id: crypto.randomUUID(),
        shareholderId,
        shareClass,
        sharesIssued: shares,
        sharesOutstanding: shares,
        sharesReserved: 0,
        originalIssueDate: now,
        originalIssuePrice: pricePerShare,
        consideration: shares * pricePerShare,
        isVested: true,
        createdAt: now,
        updatedAt: now,
      }
      holdings.set(holding.id, holding)
    }
    
    // Create ledger entry
    const ledgerEntry = this.addLedgerEntry({
      transactionType: EquityTransactionType.ISSUANCE,
      toHolderId: shareholderId,
      toClass: shareClass,
      toShares: shares,
      transactionDate: now,
      effectiveDate: now,
      pricePerShare,
      totalConsideration: shares * pricePerShare,
      description: `Issued ${shares} ${shareClass} shares to shareholder`,
      createdBy,
    })
    
    return { holding, ledgerEntry }
  }

  /**
   * Transfer shares between shareholders
   */
  transferShares(
    fromHolderId: string,
    toHolderId: string,
    shareClass: ShareClass,
    shares: number,
    pricePerShare: number,
    createdBy: string
  ): { fromHolding: ShareHolding; toHolding: ShareHolding; ledgerEntry: ShareLedgerEntry } {
    const now = new Date().toISOString()
    
    // Get from holder's holding
    const fromHoldings = this.getHoldingsByClass(shareClass)
    const fromHolding = fromHoldings.find(h => h.shareholderId === fromHolderId)
    
    if (!fromHolding || fromHolding.sharesOutstanding < shares) {
      throw new Error('Insufficient shares to transfer')
    }
    
    // Reduce from holder
    const updatedFromHolding: ShareHolding = {
      ...fromHolding,
      sharesOutstanding: fromHolding.sharesOutstanding - shares,
      updatedAt: now,
    }
    holdings.set(fromHolding.id, updatedFromHolding)
    
    // Check if to holder has existing holding
    const toHoldings = fromHoldings.filter(h => h.shareholderId === toHolderId)
    const existingToHolding = toHoldings[0]
    
    let updatedToHolding: ShareHolding
    
    if (existingToHolding) {
      updatedToHolding = {
        ...existingToHolding,
        sharesIssued: existingToHolding.sharesIssued + shares,
        sharesOutstanding: existingToHolding.sharesOutstanding + shares,
        updatedAt: now,
      }
    } else {
      updatedToHolding = {
        id: crypto.randomUUID(),
        shareholderId: toHolderId,
        shareClass,
        sharesIssued: 0,
        sharesOutstanding: shares,
        sharesReserved: 0,
        originalIssueDate: now,
        originalIssuePrice: pricePerShare,
        consideration: shares * pricePerShare,
        isVested: true,
        createdAt: now,
        updatedAt: now,
      }
    }
    holdings.set(updatedToHolding.id, updatedToHolding)
    
    // Create ledger entry
    const ledgerEntry = this.addLedgerEntry({
      transactionType: EquityTransactionType.TRANSFER,
      fromHolderId,
      fromClass: shareClass,
      fromShares: shares,
      toHolderId,
      toClass: shareClass,
      toShares: shares,
      transactionDate: now,
      effectiveDate: now,
      pricePerShare,
      totalConsideration: shares * pricePerShare,
      description: `Transferred ${shares} ${shareClass} shares`,
      createdBy,
    })
    
    return {
      fromHolding: updatedFromHolding,
      toHolding: updatedToHolding,
      ledgerEntry,
    }
  }

  // ---------------------------------------------------------------------------
  // Helper Methods
  // ---------------------------------------------------------------------------

  /**
   * Get authorized shares for a class (would come from articles)
   */
  private getAuthorizedShares(shareClass: ShareClass): number {
    const defaults: Record<ShareClass, number> = {
      [ShareClass.COMMON_A]: 5000000,
      [ShareClass.PREFERRED_A]: 2000000,
      [ShareClass.PREFERRED_B]: 2000000,
      [ShareClass.PREFERRED_C]: 1000000,
      [ShareClass.FOUNDERS_F]: 2000000,
      [ShareClass.STOCK_OPTIONS]: 1000000,
    }
    return defaults[shareClass] || 0
  }

  /**
   * Calculate voting power for a shareholder
   */
  private calculateVotingPower(shareholderId: string): number {
    const capTable = this.getCapTable()
    const holderData = capTable.byHolder.get(shareholderId)
    if (!holderData) return 0
    
    // This would need to factor in voting rights per share class
    // For simplicity, using 1:1 voting
    return calculatePercentage(holderData.shares, capTable.totalSharesOutstanding)
  }
}

// ============================================================================
// FACTORY
// ============================================================================

let registerInstance: ShareRegister | null = null

export function getShareRegister(): ShareRegister {
  if (!registerInstance) {
    registerInstance = new ShareRegister()
  }
  return registerInstance
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function getCapTableData() {
  return getShareRegister().getCapTable()
}

export function getShareholderList() {
  return getShareRegister().getAllShareholders()
}

export function getShareholdings() {
  return getShareRegister().getAllHoldings()
}

export function getCapTableSnapshot(notes?: string) {
  return getShareRegister().generateSnapshot(notes)
}

export function getLedgerHistory(limit?: number) {
  return getShareRegister().getLedgerEntries(limit)
}
