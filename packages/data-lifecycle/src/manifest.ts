/**
 * Nzila OS — Data Lifecycle Manifest Definitions + Generator
 *
 * Each NzilaOS app must declare a data lifecycle manifest describing
 * what data it stores, how long, deletion method, residency, and backup.
 *
 * Contract test DATA_LIFECYCLE_MANIFEST_REQUIRED_003 enforces that
 * every app in apps/ has a corresponding manifest entry here.
 *
 * @module @nzila/data-lifecycle/manifest
 */
import { createHash } from 'node:crypto'

// ── Types ───────────────────────────────────────────────────────────────────

export type ResidencyType = 'managed' | 'sovereign' | 'hybrid'
export type RetentionClass = 'PERMANENT' | '7_YEARS' | '3_YEARS' | '1_YEAR' | '90_DAYS' | '30_DAYS'
export type DeletionMethod = 'soft_delete' | 'hard_delete' | 'crypto_shred' | 'retention_expiry'
export type DeletionVerification = 'audit_log' | 'deletion_certificate' | 'spot_check' | 'automated_scan'
export type BackupFrequency = 'continuous' | 'daily' | 'weekly' | 'none'

export interface DataCategory {
  /** Name of the data category (e.g. "User PII", "Audit Logs") */
  name: string
  /** Description of what data is stored */
  description: string
  /** Whether this category contains PII */
  containsPii: boolean
  /** Whether this category contains financial data */
  containsFinancial: boolean
  /** Storage location (e.g. "PostgreSQL", "Azure Blob") */
  storageEngine: string
}

export interface RetentionSchedule {
  /** Data category name (must match a DataCategory.name) */
  category: string
  /** Retention class */
  retentionClass: RetentionClass
  /** Human-readable retention period */
  retentionPeriod: string
  /** Legal/compliance basis for retention */
  legalBasis: string
}

export interface DeletionPolicy {
  /** Data category name */
  category: string
  /** Deletion method */
  method: DeletionMethod
  /** Verification approach */
  verification: DeletionVerification
  /** Who can trigger deletion */
  authorizedRoles: string[]
  /** Whether deletion is reversible */
  reversible: boolean
}

export interface ResidencyOption {
  /** Residency model */
  type: ResidencyType
  /** Available regions */
  regions: string[]
  /** Whether org can choose region */
  orgSelectable: boolean
  /** Description */
  description: string
}

export interface BackupPosture {
  /** Backup frequency */
  frequency: BackupFrequency
  /** Backup provider */
  provider: string
  /** Backup location */
  location: string
  /** Encryption at rest */
  encryptedAtRest: boolean
  /** Retention of backups */
  backupRetention: string
  /** Recovery time objective */
  rtoHours: number
  /** Recovery point objective */
  rpoHours: number
}

export interface DataLifecycleManifest {
  /** App identifier (matches package name without @nzila/ prefix) */
  appId: string
  /** App display name */
  appName: string
  /** Manifest version */
  version: string
  /** When this manifest was last updated */
  lastUpdated: string
  /** Data categories stored by this app */
  dataCategories: DataCategory[]
  /** Retention schedules per category */
  retentionSchedules: RetentionSchedule[]
  /** Deletion policies per category */
  deletionPolicies: DeletionPolicy[]
  /** Residency options */
  residency: ResidencyOption
  /** Backup posture */
  backup: BackupPosture
  /** SHA-256 hash of the manifest content (excluding this field) */
  manifestHash?: string
}

// ── App Manifest Definitions ────────────────────────────────────────────────

export const APP_MANIFESTS: DataLifecycleManifest[] = [
  // ── ABR ───────────────────────────────────────────────────────────
  {
    appId: 'abr',
    appName: 'ABR Advisory & Dispute Resolution',
    version: '1.0.0',
    lastUpdated: '2026-02-28',
    dataCategories: [
      { name: 'Case Records', description: 'Advisory cases, decisions, dispute records', containsPii: true, containsFinancial: false, storageEngine: 'PostgreSQL' },
      { name: 'Evidence Packs', description: 'Sealed evidence packs for terminal events', containsPii: false, containsFinancial: false, storageEngine: 'Azure Blob' },
      { name: 'Audit Logs', description: 'ABR-domain audit events', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
      { name: 'AI Analysis', description: 'AI-generated insights and recommendations', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
    ],
    retentionSchedules: [
      { category: 'Case Records', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Regulatory compliance — advisory record keeping' },
      { category: 'Evidence Packs', retentionClass: 'PERMANENT', retentionPeriod: 'Permanent', legalBasis: 'Immutable governance evidence — cannot be deleted' },
      { category: 'Audit Logs', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Audit trail integrity' },
      { category: 'AI Analysis', retentionClass: '3_YEARS', retentionPeriod: '3 years', legalBasis: 'Operational insights — no regulatory requirement beyond 3 years' },
    ],
    deletionPolicies: [
      { category: 'Case Records', method: 'soft_delete', verification: 'audit_log', authorizedRoles: ['platform_admin'], reversible: true },
      { category: 'Evidence Packs', method: 'retention_expiry', verification: 'deletion_certificate', authorizedRoles: [], reversible: false },
      { category: 'Audit Logs', method: 'retention_expiry', verification: 'automated_scan', authorizedRoles: [], reversible: false },
      { category: 'AI Analysis', method: 'hard_delete', verification: 'audit_log', authorizedRoles: ['platform_admin'], reversible: false },
    ],
    residency: { type: 'managed', regions: ['southafricanorth', 'westeurope'], orgSelectable: true, description: 'Managed hosting with org-selectable region' },
    backup: { frequency: 'daily', provider: 'Azure Backup', location: 'Same region as primary', encryptedAtRest: true, backupRetention: '30 days', rtoHours: 4, rpoHours: 1 },
  },

  // ── NACP Exams ────────────────────────────────────────────────────
  {
    appId: 'nacp-exams',
    appName: 'NACP Examination Platform',
    version: '1.0.0',
    lastUpdated: '2026-02-28',
    dataCategories: [
      { name: 'Exam Sessions', description: 'Exam session records, scheduling, status', containsPii: true, containsFinancial: false, storageEngine: 'PostgreSQL' },
      { name: 'Submissions', description: 'Candidate exam answers and submissions', containsPii: true, containsFinancial: false, storageEngine: 'PostgreSQL' },
      { name: 'Grading Records', description: 'Finalized grades and score breakdowns', containsPii: true, containsFinancial: false, storageEngine: 'PostgreSQL' },
      { name: 'Evidence Packs', description: 'Sealed integrity evidence for terminal events', containsPii: false, containsFinancial: false, storageEngine: 'Azure Blob' },
      { name: 'Audit Logs', description: 'NACP-domain audit events', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
    ],
    retentionSchedules: [
      { category: 'Exam Sessions', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Professional certification record keeping' },
      { category: 'Submissions', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Certification verification and appeals' },
      { category: 'Grading Records', retentionClass: 'PERMANENT', retentionPeriod: 'Permanent', legalBasis: 'Professional certification — permanent record' },
      { category: 'Evidence Packs', retentionClass: 'PERMANENT', retentionPeriod: 'Permanent', legalBasis: 'Immutable governance evidence' },
      { category: 'Audit Logs', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Audit trail integrity' },
    ],
    deletionPolicies: [
      { category: 'Exam Sessions', method: 'soft_delete', verification: 'audit_log', authorizedRoles: ['platform_admin'], reversible: true },
      { category: 'Submissions', method: 'crypto_shred', verification: 'deletion_certificate', authorizedRoles: ['platform_admin'], reversible: false },
      { category: 'Grading Records', method: 'retention_expiry', verification: 'deletion_certificate', authorizedRoles: [], reversible: false },
      { category: 'Evidence Packs', method: 'retention_expiry', verification: 'deletion_certificate', authorizedRoles: [], reversible: false },
      { category: 'Audit Logs', method: 'retention_expiry', verification: 'automated_scan', authorizedRoles: [], reversible: false },
    ],
    residency: { type: 'managed', regions: ['southafricanorth', 'westeurope'], orgSelectable: true, description: 'Managed hosting with org-selectable region' },
    backup: { frequency: 'daily', provider: 'Azure Backup', location: 'Same region as primary', encryptedAtRest: true, backupRetention: '30 days', rtoHours: 2, rpoHours: 1 },
  },

  // ── Console ───────────────────────────────────────────────────────
  {
    appId: 'console',
    appName: 'NzilaOS Console',
    version: '1.0.0',
    lastUpdated: '2026-02-28',
    dataCategories: [
      { name: 'Platform Metrics', description: 'Performance, health, and operational metrics', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
      { name: 'Proof Packs', description: 'Generated governance proof packs', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
      { name: 'Audit Logs', description: 'Console operation audit trail', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
    ],
    retentionSchedules: [
      { category: 'Platform Metrics', retentionClass: '1_YEAR', retentionPeriod: '1 year', legalBasis: 'Operational monitoring — rolling window' },
      { category: 'Proof Packs', retentionClass: 'PERMANENT', retentionPeriod: 'Permanent', legalBasis: 'Immutable governance attestation' },
      { category: 'Audit Logs', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Audit trail integrity' },
    ],
    deletionPolicies: [
      { category: 'Platform Metrics', method: 'retention_expiry', verification: 'automated_scan', authorizedRoles: [], reversible: false },
      { category: 'Proof Packs', method: 'retention_expiry', verification: 'deletion_certificate', authorizedRoles: [], reversible: false },
      { category: 'Audit Logs', method: 'retention_expiry', verification: 'automated_scan', authorizedRoles: [], reversible: false },
    ],
    residency: { type: 'managed', regions: ['southafricanorth'], orgSelectable: false, description: 'Platform infrastructure — not org-selectable' },
    backup: { frequency: 'daily', provider: 'Azure Backup', location: 'Same region', encryptedAtRest: true, backupRetention: '30 days', rtoHours: 4, rpoHours: 1 },
  },

  // ── Union Eyes ────────────────────────────────────────────────────
  {
    appId: 'union-eyes',
    appName: 'Union Eyes Governance',
    version: '1.0.0',
    lastUpdated: '2026-02-28',
    dataCategories: [
      { name: 'Governance Records', description: 'Board resolutions, policies, compliance records', containsPii: true, containsFinancial: false, storageEngine: 'PostgreSQL' },
      { name: 'Audit Logs', description: 'Governance audit trail', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
    ],
    retentionSchedules: [
      { category: 'Governance Records', retentionClass: 'PERMANENT', retentionPeriod: 'Permanent', legalBasis: 'Corporate governance — permanent record' },
      { category: 'Audit Logs', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Audit trail integrity' },
    ],
    deletionPolicies: [
      { category: 'Governance Records', method: 'retention_expiry', verification: 'deletion_certificate', authorizedRoles: [], reversible: false },
      { category: 'Audit Logs', method: 'retention_expiry', verification: 'automated_scan', authorizedRoles: [], reversible: false },
    ],
    residency: { type: 'sovereign', regions: ['southafricanorth'], orgSelectable: false, description: 'Sovereign data — South Africa only' },
    backup: { frequency: 'daily', provider: 'Azure Backup', location: 'South Africa North', encryptedAtRest: true, backupRetention: '90 days', rtoHours: 2, rpoHours: 1 },
  },

  // ── Web ───────────────────────────────────────────────────────────
  {
    appId: 'web',
    appName: 'NzilaOS Web Portal',
    version: '1.0.0',
    lastUpdated: '2026-02-28',
    dataCategories: [
      { name: 'User Sessions', description: 'Authentication sessions and preferences', containsPii: true, containsFinancial: false, storageEngine: 'PostgreSQL' },
      { name: 'Content', description: 'CMS content and page data', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
    ],
    retentionSchedules: [
      { category: 'User Sessions', retentionClass: '90_DAYS', retentionPeriod: '90 days', legalBasis: 'Session management — short-lived' },
      { category: 'Content', retentionClass: '3_YEARS', retentionPeriod: '3 years', legalBasis: 'Content lifecycle management' },
    ],
    deletionPolicies: [
      { category: 'User Sessions', method: 'hard_delete', verification: 'automated_scan', authorizedRoles: ['platform_admin'], reversible: false },
      { category: 'Content', method: 'soft_delete', verification: 'audit_log', authorizedRoles: ['platform_admin', 'content_admin'], reversible: true },
    ],
    residency: { type: 'managed', regions: ['southafricanorth', 'westeurope'], orgSelectable: true, description: 'Managed hosting with org-selectable region' },
    backup: { frequency: 'daily', provider: 'Azure Backup', location: 'Same region', encryptedAtRest: true, backupRetention: '30 days', rtoHours: 4, rpoHours: 2 },
  },

  // ── Orchestrator API ──────────────────────────────────────────────
  {
    appId: 'orchestrator-api',
    appName: 'Orchestrator API',
    version: '1.0.0',
    lastUpdated: '2026-02-28',
    dataCategories: [
      { name: 'API Request Logs', description: 'Request/response metadata for orchestration', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
      { name: 'Audit Logs', description: 'API operation audit trail', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
    ],
    retentionSchedules: [
      { category: 'API Request Logs', retentionClass: '90_DAYS', retentionPeriod: '90 days', legalBasis: 'Operational debugging' },
      { category: 'Audit Logs', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Audit trail integrity' },
    ],
    deletionPolicies: [
      { category: 'API Request Logs', method: 'retention_expiry', verification: 'automated_scan', authorizedRoles: [], reversible: false },
      { category: 'Audit Logs', method: 'retention_expiry', verification: 'automated_scan', authorizedRoles: [], reversible: false },
    ],
    residency: { type: 'managed', regions: ['southafricanorth'], orgSelectable: false, description: 'Platform infrastructure' },
    backup: { frequency: 'daily', provider: 'Azure Backup', location: 'Same region', encryptedAtRest: true, backupRetention: '30 days', rtoHours: 2, rpoHours: 1 },
  },

  // ── CFO ───────────────────────────────────────────────────────────
  {
    appId: 'cfo',
    appName: 'CFO Finance Dashboard',
    version: '1.0.0',
    lastUpdated: '2026-02-28',
    dataCategories: [
      { name: 'Financial Reports', description: 'Revenue, expense, and P&L reports', containsPii: false, containsFinancial: true, storageEngine: 'PostgreSQL' },
      { name: 'Audit Logs', description: 'Finance operation audit trail', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
    ],
    retentionSchedules: [
      { category: 'Financial Reports', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Financial record keeping — tax and audit' },
      { category: 'Audit Logs', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Audit trail integrity' },
    ],
    deletionPolicies: [
      { category: 'Financial Reports', method: 'retention_expiry', verification: 'deletion_certificate', authorizedRoles: [], reversible: false },
      { category: 'Audit Logs', method: 'retention_expiry', verification: 'automated_scan', authorizedRoles: [], reversible: false },
    ],
    residency: { type: 'sovereign', regions: ['southafricanorth'], orgSelectable: false, description: 'Financial data — sovereign residency' },
    backup: { frequency: 'daily', provider: 'Azure Backup', location: 'South Africa North', encryptedAtRest: true, backupRetention: '90 days', rtoHours: 2, rpoHours: 1 },
  },

  // ── Partners ──────────────────────────────────────────────────────
  {
    appId: 'partners',
    appName: 'Partner Portal',
    version: '1.0.0',
    lastUpdated: '2026-02-28',
    dataCategories: [
      { name: 'Partner Records', description: 'Partner profiles and agreements', containsPii: true, containsFinancial: false, storageEngine: 'PostgreSQL' },
      { name: 'Audit Logs', description: 'Partner operation audit trail', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
    ],
    retentionSchedules: [
      { category: 'Partner Records', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Partnership agreement retention' },
      { category: 'Audit Logs', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Audit trail integrity' },
    ],
    deletionPolicies: [
      { category: 'Partner Records', method: 'soft_delete', verification: 'audit_log', authorizedRoles: ['platform_admin'], reversible: true },
      { category: 'Audit Logs', method: 'retention_expiry', verification: 'automated_scan', authorizedRoles: [], reversible: false },
    ],
    residency: { type: 'managed', regions: ['southafricanorth', 'westeurope'], orgSelectable: true, description: 'Managed hosting' },
    backup: { frequency: 'daily', provider: 'Azure Backup', location: 'Same region', encryptedAtRest: true, backupRetention: '30 days', rtoHours: 4, rpoHours: 2 },
  },

  // ── Shop Quoter ───────────────────────────────────────────────────
  {
    appId: 'shop-quoter',
    appName: 'Shop Quoter',
    version: '1.0.0',
    lastUpdated: '2026-02-28',
    dataCategories: [
      { name: 'Quotes', description: 'Commerce quotes and pricing', containsPii: false, containsFinancial: true, storageEngine: 'PostgreSQL' },
      { name: 'Audit Logs', description: 'Commerce audit trail', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
    ],
    retentionSchedules: [
      { category: 'Quotes', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Financial record keeping' },
      { category: 'Audit Logs', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Audit trail integrity' },
    ],
    deletionPolicies: [
      { category: 'Quotes', method: 'soft_delete', verification: 'audit_log', authorizedRoles: ['platform_admin'], reversible: true },
      { category: 'Audit Logs', method: 'retention_expiry', verification: 'automated_scan', authorizedRoles: [], reversible: false },
    ],
    residency: { type: 'managed', regions: ['southafricanorth'], orgSelectable: false, description: 'Managed hosting' },
    backup: { frequency: 'daily', provider: 'Azure Backup', location: 'Same region', encryptedAtRest: true, backupRetention: '30 days', rtoHours: 4, rpoHours: 2 },
  },

  // ── Trade ─────────────────────────────────────────────────────────
  {
    appId: 'trade',
    appName: 'Trade Platform',
    version: '1.0.0',
    lastUpdated: '2026-02-28',
    dataCategories: [
      { name: 'Trade Records', description: 'FX and trade transaction records', containsPii: false, containsFinancial: true, storageEngine: 'PostgreSQL' },
      { name: 'Audit Logs', description: 'Trade operation audit trail', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
    ],
    retentionSchedules: [
      { category: 'Trade Records', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Financial regulatory compliance' },
      { category: 'Audit Logs', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Audit trail integrity' },
    ],
    deletionPolicies: [
      { category: 'Trade Records', method: 'retention_expiry', verification: 'deletion_certificate', authorizedRoles: [], reversible: false },
      { category: 'Audit Logs', method: 'retention_expiry', verification: 'automated_scan', authorizedRoles: [], reversible: false },
    ],
    residency: { type: 'sovereign', regions: ['southafricanorth'], orgSelectable: false, description: 'Financial data — sovereign' },
    backup: { frequency: 'daily', provider: 'Azure Backup', location: 'South Africa North', encryptedAtRest: true, backupRetention: '90 days', rtoHours: 1, rpoHours: 0.5 },
  },

  // ── Zonga ─────────────────────────────────────────────────────────
  {
    appId: 'zonga',
    appName: 'Zonga Revenue Platform',
    version: '1.0.0',
    lastUpdated: '2026-02-28',
    dataCategories: [
      { name: 'Revenue Events', description: 'Revenue tracking and billing events', containsPii: false, containsFinancial: true, storageEngine: 'PostgreSQL' },
      { name: 'Audit Logs', description: 'Revenue operation audit trail', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
    ],
    retentionSchedules: [
      { category: 'Revenue Events', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Financial record keeping' },
      { category: 'Audit Logs', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Audit trail integrity' },
    ],
    deletionPolicies: [
      { category: 'Revenue Events', method: 'retention_expiry', verification: 'deletion_certificate', authorizedRoles: [], reversible: false },
      { category: 'Audit Logs', method: 'retention_expiry', verification: 'automated_scan', authorizedRoles: [], reversible: false },
    ],
    residency: { type: 'managed', regions: ['southafricanorth'], orgSelectable: false, description: 'Managed hosting' },
    backup: { frequency: 'daily', provider: 'Azure Backup', location: 'Same region', encryptedAtRest: true, backupRetention: '30 days', rtoHours: 2, rpoHours: 1 },
  },

  // ── Pondu ─────────────────────────────────────────────────────────
  {
    appId: 'pondu',
    appName: 'Pondu Media Platform',
    version: '1.0.0',
    lastUpdated: '2026-02-28',
    dataCategories: [
      { name: 'Media Content', description: 'Media assets and metadata', containsPii: false, containsFinancial: false, storageEngine: 'Azure Blob' },
      { name: 'Audit Logs', description: 'Media operation audit trail', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
    ],
    retentionSchedules: [
      { category: 'Media Content', retentionClass: '3_YEARS', retentionPeriod: '3 years', legalBasis: 'Content lifecycle management' },
      { category: 'Audit Logs', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Audit trail integrity' },
    ],
    deletionPolicies: [
      { category: 'Media Content', method: 'hard_delete', verification: 'audit_log', authorizedRoles: ['platform_admin', 'content_admin'], reversible: false },
      { category: 'Audit Logs', method: 'retention_expiry', verification: 'automated_scan', authorizedRoles: [], reversible: false },
    ],
    residency: { type: 'managed', regions: ['southafricanorth', 'westeurope'], orgSelectable: true, description: 'Managed hosting' },
    backup: { frequency: 'daily', provider: 'Azure Backup', location: 'Same region', encryptedAtRest: true, backupRetention: '30 days', rtoHours: 4, rpoHours: 2 },
  },

  // ── Cora ──────────────────────────────────────────────────────────
  {
    appId: 'cora',
    appName: 'Cora AI Assistant',
    version: '1.0.0',
    lastUpdated: '2026-02-28',
    dataCategories: [
      { name: 'Conversation History', description: 'AI conversation logs and context', containsPii: true, containsFinancial: false, storageEngine: 'PostgreSQL' },
      { name: 'Audit Logs', description: 'AI operation audit trail', containsPii: false, containsFinancial: false, storageEngine: 'PostgreSQL' },
    ],
    retentionSchedules: [
      { category: 'Conversation History', retentionClass: '90_DAYS', retentionPeriod: '90 days', legalBasis: 'User experience — short-lived context' },
      { category: 'Audit Logs', retentionClass: '7_YEARS', retentionPeriod: '7 years', legalBasis: 'Audit trail integrity' },
    ],
    deletionPolicies: [
      { category: 'Conversation History', method: 'hard_delete', verification: 'automated_scan', authorizedRoles: ['platform_admin'], reversible: false },
      { category: 'Audit Logs', method: 'retention_expiry', verification: 'automated_scan', authorizedRoles: [], reversible: false },
    ],
    residency: { type: 'managed', regions: ['southafricanorth'], orgSelectable: false, description: 'Managed hosting' },
    backup: { frequency: 'daily', provider: 'Azure Backup', location: 'Same region', encryptedAtRest: true, backupRetention: '7 days', rtoHours: 8, rpoHours: 4 },
  },
]

// ── Manifest Generation ─────────────────────────────────────────────────────

/**
 * Generate a manifest for a specific app (by appId).
 * Returns null if no manifest is defined for the app.
 */
export function generateAppManifest(appId: string): DataLifecycleManifest | null {
  const manifest = APP_MANIFESTS.find((m) => m.appId === appId)
  if (!manifest) return null

  return {
    ...manifest,
    manifestHash: computeManifestHash(manifest),
  }
}

/**
 * Generate manifests for all registered apps.
 */
export function generateAllManifests(): DataLifecycleManifest[] {
  return APP_MANIFESTS.map((m) => ({
    ...m,
    manifestHash: computeManifestHash(m),
  }))
}

// ── Validation ──────────────────────────────────────────────────────────────

export interface ManifestValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate a data lifecycle manifest for completeness and consistency.
 */
export function validateManifest(manifest: DataLifecycleManifest): ManifestValidationResult {
  const errors: string[] = []

  if (!manifest.appId) errors.push('appId is required')
  if (!manifest.appName) errors.push('appName is required')
  if (!manifest.version) errors.push('version is required')
  if (manifest.dataCategories.length === 0) errors.push('At least one data category is required')

  // Every data category must have a retention schedule
  for (const cat of manifest.dataCategories) {
    const hasRetention = manifest.retentionSchedules.some((r) => r.category === cat.name)
    if (!hasRetention) {
      errors.push(`Data category "${cat.name}" has no retention schedule`)
    }

    const hasDeletion = manifest.deletionPolicies.some((d) => d.category === cat.name)
    if (!hasDeletion) {
      errors.push(`Data category "${cat.name}" has no deletion policy`)
    }
  }

  // Residency must be defined
  if (!manifest.residency) errors.push('Residency option is required')
  if (!manifest.backup) errors.push('Backup posture is required')

  // Backup must have meaningful RTO/RPO
  if (manifest.backup && manifest.backup.rtoHours <= 0) {
    errors.push('Backup RTO must be positive')
  }

  return { valid: errors.length === 0, errors }
}

// ── Hash computation ────────────────────────────────────────────────────────

function computeManifestHash(manifest: DataLifecycleManifest): string {
  const { manifestHash: _, ...content } = manifest
  const sorted = JSON.stringify(content, Object.keys(content).sort())
  return createHash('sha256').update(sorted).digest('hex')
}
