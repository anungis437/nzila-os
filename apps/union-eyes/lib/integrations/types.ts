/**
 * Integration Framework - Core Types
 * 
 * Common types and interfaces for all external system integrations
 * (HRIS, Accounting, Insurance, Pension, LMS, etc.)
 */


/**
 * Supported integration types
 */
export enum IntegrationType {
  HRIS = 'hris',
  ACCOUNTING = 'accounting',
  INSURANCE = 'insurance',
  PENSION = 'pension',
  LMS = 'lms',
  COMMUNICATION = 'communication',
  DOCUMENT_MANAGEMENT = 'document_management',
  CALENDAR = 'calendar',
  SOCIAL_MEDIA = 'social_media',
  PAYMENT = 'payment',
}

/**
 * Integration provider identifiers
 */
export enum IntegrationProvider {
  // HRIS
  WORKDAY = 'workday',
  BAMBOOHR = 'bamboohr',
  ADP = 'adp',
  CERIDIAN_DAYFORCE = 'ceridian_dayforce',
  UKG_PRO = 'ukg_pro',
  
  // Accounting
  QUICKBOOKS = 'quickbooks',
  XERO = 'xero',
  SAGE_INTACCT = 'sage_intacct',
  FRESHBOOKS = 'freshbooks',
  WAVE = 'wave',
  
  // Insurance/Benefits
  SUNLIFE = 'sunlife',
  MANULIFE = 'manulife',
  BLUE_CROSS = 'blue_cross',
  GREEN_SHIELD = 'green_shield',
  GREEN_SHIELD_CANADA = 'green_shield_canada',
  CANADA_LIFE = 'canada_life',
  INDUSTRIAL_ALLIANCE = 'industrial_alliance',
  SUN_LIFE = 'sun_life',
  
  // Pension
  OTPP = 'otpp',
  CPP_QPP = 'cpp_qpp',
  PROVINCIAL_PENSION = 'provincial_pension',
  
  // LMS
  LINKEDIN_LEARNING = 'linkedin_learning',
  UDEMY = 'udemy',
  COURSERA = 'coursera',
  
  // Communication
  SLACK = 'slack',
  MICROSOFT_TEAMS = 'microsoft_teams',
  
  // Document Management
  SHAREPOINT = 'sharepoint',
  GOOGLE_DRIVE = 'google_drive',
  DROPBOX = 'dropbox',
  
  // Custom/Internal
  CUSTOM = 'custom',
}

/**
 * Integration sync status
 */
export enum SyncStatus {
  IDLE = 'idle',
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  PARTIAL = 'partial',
  CANCELLED = 'cancelled',
}

/**
 * Sync type
 */
export enum SyncType {
  FULL = 'full',
  INCREMENTAL = 'incremental',
  REAL_TIME = 'real_time',
}

/**
 * Integration connection status
 */
export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  AUTHENTICATING = 'authenticating',
  EXPIRED = 'expired',
}

/**
 * Webhook event status
 */
export enum WebhookStatus {
  RECEIVED = 'received',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  IGNORED = 'ignored',
}

/**
 * Integration configuration
 */
export interface IntegrationConfig {
  organizationId: string;
  type: IntegrationType;
  provider: IntegrationProvider;
  credentials: IntegrationCredentials;
  settings?: Record<string, unknown>;
  webhookUrl?: string;
  enabled: boolean;
}

/**
 * Integration credentials (encrypted in storage)
 */
export interface IntegrationCredentials {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Integration capabilities
 */
export interface IntegrationCapabilities {
  supportsFullSync: boolean;
  supportsIncrementalSync: boolean;
  supportsWebhooks: boolean;
  supportsRealTime: boolean;
  supportedEntities: string[];
  requiresOAuth: boolean;
  supportedScopes?: string[];
  rateLimitPerMinute?: number;
  rateLimitPerHour?: number;
}

/**
 * Sync options
 */
export interface SyncOptions {
  type: SyncType;
  entities?: string[];
  filters?: Record<string, unknown>;
  since?: Date;
  cursor?: string;
  limit?: number;
  dryRun?: boolean;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors?: SyncError[];
  cursor?: string;
  nextSyncAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Sync error
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface SyncError {
  entity: string;
  entityId?: string;
  error: string;
  details?: unknown;
}

/**
 * Webhook event
 */
export interface WebhookEvent {
  id: string;
  provider: IntegrationProvider;
  type: string;
  timestamp: Date;
  data: unknown;
  signature?: string;
  verified: boolean;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  status: ConnectionStatus;
  latencyMs?: number;
  rateLimitRemaining?: number;
  lastError?: string;
  lastCheckedAt: Date;
}

/**
 * Base integration interface
 * All integration adapters must implement this
 */
export interface IIntegration {
  readonly type: IntegrationType;
  readonly provider: IntegrationProvider;
  readonly capabilities: IntegrationCapabilities;
  
  /**
   * Initialize the integration with configuration
   */
  initialize(config: IntegrationConfig): Promise<void>;
  
  /**
   * Connect to the external system
   */
  connect(): Promise<void>;
  
  /**
   * Disconnect from the external system
   */
  disconnect(): Promise<void>;
  
  /**
   * Check health and connectivity
   */
  healthCheck(): Promise<HealthCheckResult>;
  
  /**
   * Perform a sync operation
   */
  sync(options: SyncOptions): Promise<SyncResult>;
  
  /**
   * Verify webhook signature
   */
  verifyWebhook(payload: string, signature: string): Promise<boolean>;
  
  /**
   * Process webhook event
   */
  processWebhook(event: WebhookEvent): Promise<void>;
  
  /**
   * Refresh authentication if needed
   */
  refreshAuth?(): Promise<void>;
}

/**
 * Integration error types
 */
export class IntegrationError extends Error {
  constructor(
    message: string,
    public readonly provider: IntegrationProvider,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

export class ConnectionError extends IntegrationError {
  constructor(message: string, provider: IntegrationProvider, details?: unknown) {
    super(message, provider, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

export class AuthenticationError extends IntegrationError {
  constructor(message: string, provider: IntegrationProvider, details?: unknown) {
    super(message, provider, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class SyncError extends IntegrationError {
  constructor(message: string, provider: IntegrationProvider, details?: unknown) {
    super(message, provider, 'SYNC_ERROR', details);
    this.name = 'SyncError';
  }
}

export class WebhookError extends IntegrationError {
  constructor(message: string, provider: IntegrationProvider, details?: unknown) {
    super(message, provider, 'WEBHOOK_ERROR', details);
    this.name = 'WebhookError';
  }
}

export class RateLimitError extends IntegrationError {
  constructor(
    message: string,
    provider: IntegrationProvider,
    public readonly retryAfter?: number,
    details?: unknown
  ) {
    super(message, provider, 'RATE_LIMIT_ERROR', details);
    this.name = 'RateLimitError';
  }
}
