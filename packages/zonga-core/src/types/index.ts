/**
 * @nzila/zonga-core — Domain Types
 *
 * All Zonga content platform domain types. No DB, no framework — pure TypeScript.
 * Nzila convention: org scoping uses "orgId" (the Nzila org_id column).
 *
 * @module @nzila/zonga-core/types
 */
import type {
  CreatorStatus,
  CreatorOnboardingStatus,
  AssetType,
  AssetStatus,
  ReleaseStatus,
  ReleaseType,
  RevenueType,
  PayoutStatus,
  PayoutRail,
  LedgerEntryType,
  ZongaRole,
  ZongaCurrency,
  ZongaLanguage,
  AfricanGenre as _AfricanGenre,
  AudioQuality,
  EventStatus,
  TicketPurchaseStatus,
  PlaylistVisibility,
  PlaylistOwnerType,
  ModerationCaseType,
  ModerationCaseStatus,
  FavoriteEntityType,
  ListenerActivityType,
  NotificationType,
  PayoutPreviewStatus,
  StreamProtocol,
  PlaybackState,
  DownloadStatus,
  RightsOwnerRole,
  SplitAgreementStatus,
  DisputeStatus,
  DisputeType,
  TakedownReason,
  TakedownStatus,
  DistributionTarget,
  EventType,
  TicketTier,
  TicketTransferStatus,
  RefundStatus,
  ScanResult,
  PromoCodeType,
  SettlementStatus,
  ChargebackStatus,
  TranscodeJobStatus,
  MediaValidationResult,
  RecommendationType,
  FraudSignalType,
  MoodTag,
  RegionTag,
  VerificationStatus,
  VerificationType,
  ConsentType,
  ExportJobStatus,
  ExportFormat,
} from '../enums'

// ── Branded Types ───────────────────────────────────────────────────────────

/** Unique creator reference. */
export type CreatorRef = string & { readonly __brand: 'CreatorRef' }

/** Unique content asset reference. */
export type AssetRef = string & { readonly __brand: 'AssetRef' }

// ── Context ─────────────────────────────────────────────────────────────────

/**
 * Zonga org context carried through every request.
 *
 * `orgId` is the canonical field (aligns with @nzila/org).
 *
 * @see {@link @nzila/org OrgContext} for the canonical base type.
 */
export interface ZongaOrgContext {
  /** Organisation UUID — canonical field. */
  readonly orgId: string
  /** Authenticated user performing the action. */
  readonly actorId: string
  /** User's role within this org. */
  readonly role: ZongaRole
  /** Granular permission keys. */
  readonly permissions: readonly string[]
  /** Request-level correlation ID for tracing. */
  readonly requestId: string
}

// ── Creator ─────────────────────────────────────────────────────────────────


export interface Creator {
  readonly id: string
  /** @deprecated Use ZongaOrgContext.orgId — entity-level orgId will be removed. */
  readonly orgId: string
  readonly userId: string
  readonly displayName: string
  readonly bio: string | null
  readonly avatarUrl: string | null
  readonly status: CreatorStatus
  readonly genre: string | null
  readonly country: string | null
  readonly verified: boolean
  /** Preferred UI / metadata language. */
  readonly language: ZongaLanguage | null
  /** African region code (e.g. 'west', 'east', 'southern'). */
  readonly region: CreatorRegion | null
  /** How the creator receives payouts. */
  readonly payoutRail: PayoutRail | null
  /** Mobile money phone number or payout account ref. */
  readonly payoutAccountRef: string | null
  /** Preferred payout currency. */
  readonly payoutCurrency: ZongaCurrency | null
  readonly createdAt: string
  readonly updatedAt: string
}

/** Broad geographic region within Africa for filtering and analytics. */
export type CreatorRegion = 'west' | 'east' | 'central' | 'southern' | 'north' | 'diaspora'

// ── Content Asset ───────────────────────────────────────────────────────────

export interface ContentAsset {
  readonly id: string
  readonly orgId: string
  readonly creatorId: string
  readonly title: string
  readonly type: AssetType
  readonly status: AssetStatus
  readonly description: string | null
  readonly storageUrl: string | null
  readonly coverArtUrl: string | null
  readonly durationSeconds: number | null
  readonly genre: string | null
  /** Content / lyrics language. */
  readonly language: ZongaLanguage | null
  /** Featured / collaborating artists. */
  readonly collaborators: readonly string[]
  /** ISRC code for distribution tracking. */
  readonly isrc: string | null
  /** SHA-256 fingerprint of the original uploaded file. */
  readonly audioFingerprint: string | null
  /** Available quality tiers for the encoded file. */
  readonly qualityTiers: readonly AudioQuality[]
  readonly metadata: Readonly<Record<string, unknown>>
  readonly publishedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Release ─────────────────────────────────────────────────────────────────

export interface Release {
  readonly id: string
  readonly orgId: string
  readonly creatorId: string
  readonly title: string
  readonly status: ReleaseStatus
  readonly releaseDate: string | null
  readonly metadata: Readonly<Record<string, unknown>>
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Revenue Event (append-only ledger entry) ────────────────────────────────

export interface RevenueEvent {
  readonly id: string
  readonly orgId: string
  readonly creatorId: string
  readonly assetId: string | null
  readonly type: RevenueType
  readonly amount: number
  readonly currency: string
  readonly description: string | null
  readonly externalRef: string | null
  readonly metadata: Readonly<Record<string, unknown>>
  readonly occurredAt: string
  readonly createdAt: string
}

// ── Wallet Ledger Entry ─────────────────────────────────────────────────────

export interface WalletLedgerEntry {
  readonly id: string
  readonly orgId: string
  readonly creatorId: string
  readonly entryType: LedgerEntryType
  readonly amount: number
  readonly currency: string
  readonly description: string | null
  readonly revenueEventId: string | null
  readonly payoutId: string | null
  readonly balanceAfter: number
  readonly createdAt: string
}

// ── Payout ──────────────────────────────────────────────────────────────────

export interface Payout {
  readonly id: string
  readonly orgId: string
  readonly creatorId: string
  readonly amount: number
  readonly currency: string
  readonly status: PayoutStatus
  /** Rail used for this payout (M-Pesa, Stripe, bank, etc.). */
  readonly payoutRail: PayoutRail | null
  readonly periodStart: string
  readonly periodEnd: string
  readonly revenueEventCount: number
  readonly metadata: Readonly<Record<string, unknown>>
  readonly previewedAt: string | null
  readonly approvedAt: string | null
  readonly completedAt: string | null
  readonly failedReason: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Collaborative Release Split ─────────────────────────────────────────────

/**
 * Defines how revenue from a release is split among collaborators.
 * Stored in release metadata, enforced at payout preview time.
 */
export interface RoyaltySplit {
  readonly creatorId: string
  readonly displayName: string
  readonly role: 'primary' | 'featured' | 'producer' | 'songwriter'
  /** Percentage of net revenue (must sum to 100 across all splits). */
  readonly sharePercent: number
}

// ── Upload Result ───────────────────────────────────────────────────────────

/** Result of uploading an audio file to blob storage. */
export interface AudioUploadResult {
  readonly blobPath: string
  readonly sha256: string
  readonly sizeBytes: number
  readonly durationSeconds: number | null
  readonly contentType: string
}

// ── Payout Preview (computed, not persisted) ────────────────────────────────

export interface PayoutPreview {
  readonly creatorId: string
  readonly orgId: string
  readonly periodStart: string
  readonly periodEnd: string
  readonly totalRevenue: number
  readonly platformFee: number
  readonly netPayout: number
  readonly currency: string
  readonly revenueEventCount: number
  readonly breakdown: readonly PayoutBreakdownItem[]
}

export interface PayoutBreakdownItem {
  readonly revenueType: RevenueType
  readonly eventCount: number
  readonly totalAmount: number
}

// ── Creator Account ────────────────────────────────────────────────────────

export interface CreatorAccount {
  readonly id: string
  readonly orgId: string
  readonly creatorId: string
  readonly email: string
  readonly phone: string | null
  readonly onboardingStatus: CreatorOnboardingStatus
  readonly kycStatus: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Listener / Fan ─────────────────────────────────────────────────────────

export interface Listener {
  readonly id: string
  readonly orgId: string
  readonly displayName: string
  readonly email: string | null
  readonly city: string | null
  readonly country: string | null
  readonly preferencesJson: Readonly<Record<string, unknown>>
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ListenerFollow {
  readonly id: string
  readonly orgId: string
  readonly listenerId: string
  readonly creatorId: string
  readonly createdAt: string
}

export interface ListenerFavorite {
  readonly id: string
  readonly orgId: string
  readonly listenerId: string
  readonly entityType: FavoriteEntityType
  readonly targetEntityId: string
  readonly createdAt: string
}

export interface ListenerActivity {
  readonly id: string
  readonly orgId: string
  readonly listenerId: string
  readonly activityType: ListenerActivityType
  readonly entityType: string | null
  readonly targetEntityId: string | null
  readonly metadataJson: Readonly<Record<string, unknown>>
  readonly createdAt: string
}

// ── Playlist ────────────────────────────────────────────────────────────────

export interface Playlist {
  readonly id: string
  readonly orgId: string
  readonly ownerType: PlaylistOwnerType
  readonly ownerId: string
  readonly title: string
  readonly description: string | null
  readonly visibility: PlaylistVisibility
  readonly createdAt: string
  readonly updatedAt: string
}

export interface PlaylistItem {
  readonly id: string
  readonly playlistId: string
  readonly entityType: string
  readonly targetEntityId: string
  readonly position: number
  readonly createdAt: string
}

// ── Event / Ticketing ──────────────────────────────────────────────────────

export interface ZongaEvent {
  readonly id: string
  readonly orgId: string
  readonly creatorId: string | null
  readonly title: string
  readonly description: string | null
  readonly venue: string | null
  readonly city: string | null
  readonly country: string | null
  readonly startsAt: string
  readonly endsAt: string | null
  readonly status: EventStatus
  readonly ticketingStatus: string | null
  readonly imageUrl: string | null
  readonly metadata: Readonly<Record<string, unknown>>
  readonly createdAt: string
  readonly updatedAt: string
}

export interface TicketType {
  readonly id: string
  readonly orgId: string
  readonly eventId: string
  readonly ticketType: string
  readonly price: number
  readonly currency: string
  readonly quantityAvailable: number
  readonly createdAt: string
}

export interface TicketPurchase {
  readonly id: string
  readonly orgId: string
  readonly eventId: string
  readonly ticketTypeId: string
  readonly listenerId: string | null
  readonly stripeCheckoutSessionId: string | null
  readonly status: TicketPurchaseStatus
  readonly amount: number
  readonly currency: string
  readonly createdAt: string
  readonly confirmedAt: string | null
}

// ── Moderation / Integrity ─────────────────────────────────────────────────

export interface ModerationCase {
  readonly id: string
  readonly orgId: string
  readonly entityType: string
  readonly targetEntityId: string
  readonly caseType: ModerationCaseType
  readonly status: ModerationCaseStatus
  readonly severity: string
  readonly notes: string | null
  readonly assignedTo: string | null
  readonly resolvedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface IntegritySignal {
  readonly id: string
  readonly orgId: string
  readonly entityType: string
  readonly targetEntityId: string
  readonly signalType: string
  readonly severity: string
  readonly explanation: string | null
  readonly metadataJson: Readonly<Record<string, unknown>>
  readonly createdAt: string
}

// ── Notification ────────────────────────────────────────────────────────────

export interface ZongaNotification {
  readonly id: string
  readonly orgId: string
  readonly userId: string
  readonly type: NotificationType
  readonly title: string
  readonly body: string | null
  readonly link: string | null
  readonly read: boolean
  readonly createdAt: string
}

// ── Release Track ───────────────────────────────────────────────────────────

export interface ReleaseTrack {
  readonly id: string
  readonly releaseId: string
  readonly assetId: string
  readonly trackNumber: number
  readonly titleOverride: string | null
  readonly createdAt: string
}

// ── Payout Preview (persisted) ─────────────────────────────────────────────

export interface PayoutPreviewRecord {
  readonly id: string
  readonly orgId: string
  readonly creatorId: string
  readonly periodStart: string
  readonly periodEnd: string
  readonly totalAmount: number
  readonly currency: string
  readonly status: PayoutPreviewStatus
  readonly createdAt: string
  readonly updatedAt: string
}

// ── User / Identity ─────────────────────────────────────────────────────────

export interface UserProfile {
  readonly id: string
  readonly userId: string
  readonly displayName: string
  readonly bio: string | null
  readonly avatarUrl: string | null
  readonly city: string | null
  readonly country: string | null
  readonly language: ZongaLanguage | null
  readonly timezone: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface UserPreferences {
  readonly userId: string
  readonly audioQuality: AudioQuality
  readonly offlineEnabled: boolean
  readonly lowBandwidthMode: boolean
  readonly autoPlay: boolean
  readonly explicitContentFilter: boolean
  readonly preferredCurrency: ZongaCurrency
  readonly preferredLanguage: ZongaLanguage
  readonly emailNotifications: boolean
  readonly pushNotifications: boolean
}

export interface SessionDevice {
  readonly id: string
  readonly userId: string
  readonly deviceType: string
  readonly deviceName: string | null
  readonly userAgent: string | null
  readonly lastActiveAt: string
  readonly createdAt: string
}

// ── Creator / Team ──────────────────────────────────────────────────────────

export interface CreatorVerification {
  readonly id: string
  readonly creatorId: string
  readonly verificationType: VerificationType
  readonly status: VerificationStatus
  readonly submittedAt: string
  readonly evidenceUrls: readonly string[]
  readonly reviewedBy: string | null
  readonly reviewNotes: string | null
  readonly reviewedAt: string | null
  readonly expiresAt: string | null
  readonly createdAt: string
}

export interface Label {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly displayName: string
  readonly logoUrl: string | null
  readonly website: string | null
  readonly country: string | null
  readonly verified: boolean
  readonly contactEmail: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreatorTeamMember {
  readonly id: string
  readonly creatorId: string
  readonly userId: string
  readonly displayName: string
  readonly role: 'manager' | 'admin' | 'contributor' | 'viewer'
  readonly permissions: readonly string[]
  readonly invitedBy: string
  readonly acceptedAt: string | null
  readonly createdAt: string
}

export interface CollaborationInvite {
  readonly id: string
  readonly creatorId: string
  readonly inviteeEmail: string
  readonly role: string
  readonly message: string | null
  readonly status: 'pending' | 'accepted' | 'declined' | 'expired'
  readonly expiresAt: string
  readonly createdAt: string
}

// ── Track / Album (Extended) ────────────────────────────────────────────────

export interface TrackVersion {
  readonly id: string
  readonly assetId: string
  readonly versionNumber: number
  readonly storageUrl: string
  readonly audioFingerprint: string
  readonly fileSizeBytes: number
  readonly durationSeconds: number
  readonly encoding: string
  readonly uploadedBy: string
  readonly createdAt: string
}

export interface EditorialCollection {
  readonly id: string
  readonly orgId: string
  readonly title: string
  readonly subtitle: string | null
  readonly description: string | null
  readonly coverImageUrl: string | null
  readonly curatorId: string | null
  readonly tags: readonly string[]
  readonly moodTags: readonly MoodTag[]
  readonly regionTags: readonly RegionTag[]
  readonly featured: boolean
  readonly publishedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Rights / Ownership ──────────────────────────────────────────────────────

export interface RightsOwner {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly entityType: 'individual' | 'label' | 'publisher' | 'collective'
  readonly contactEmail: string | null
  readonly country: string | null
  readonly ipiNumber: string | null
  readonly verified: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

export interface RightsShare {
  readonly id: string
  readonly assetId: string
  readonly ownerId: string
  readonly ownerRole: RightsOwnerRole
  readonly sharePercent: number
  readonly territory: string
  readonly validFrom: string
  readonly validUntil: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface SplitAgreement {
  readonly id: string
  readonly orgId: string
  readonly releaseId: string | null
  readonly assetId: string | null
  readonly title: string
  readonly status: SplitAgreementStatus
  readonly shares: readonly SplitAgreementShare[]
  readonly effectiveDate: string
  readonly expiryDate: string | null
  readonly createdBy: string
  readonly approvedBy: string | null
  readonly version: number
  readonly previousVersionId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface SplitAgreementShare {
  readonly ownerId: string
  readonly ownerName: string
  readonly role: RightsOwnerRole
  readonly sharePercent: number
  readonly accepted: boolean
  readonly acceptedAt: string | null
}

export interface ISRCRecord {
  readonly assetId: string
  readonly isrc: string
  readonly registrant: string | null
  readonly registeredAt: string
  readonly country: string | null
}

export interface UPCRecord {
  readonly releaseId: string
  readonly upc: string
  readonly registeredAt: string
}

export interface PublishingMetadata {
  readonly assetId: string
  readonly composers: readonly string[]
  readonly lyricists: readonly string[]
  readonly publishers: readonly string[]
  readonly iswcCode: string | null
  readonly territoryRestrictions: readonly string[]
  readonly mechanicalRightsHolder: string | null
  readonly performanceRightsOrg: string | null
}

export interface MasterOwnership {
  readonly assetId: string
  readonly ownerId: string
  readonly ownerName: string
  readonly ownerType: 'creator' | 'label' | 'distributor'
  readonly acquiredAt: string
  readonly territory: string
  readonly exclusive: boolean
}

export interface ReleaseTerritoryRule {
  readonly id: string
  readonly releaseId: string
  readonly territory: string
  readonly allowed: boolean
  readonly reason: string | null
  readonly effectiveFrom: string
  readonly effectiveUntil: string | null
}

// ── Disputes / Takedowns ────────────────────────────────────────────────────

export interface RightsDispute {
  readonly id: string
  readonly orgId: string
  readonly disputeType: DisputeType
  readonly status: DisputeStatus
  readonly claimantId: string
  readonly respondentId: string | null
  readonly assetId: string | null
  readonly releaseId: string | null
  readonly description: string
  readonly evidenceUrls: readonly string[]
  readonly resolution: string | null
  readonly resolvedBy: string | null
  readonly resolvedAt: string | null
  readonly payoutBlockActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

export interface TakedownRequest {
  readonly id: string
  readonly orgId: string
  readonly assetId: string | null
  readonly releaseId: string | null
  readonly reason: TakedownReason
  readonly status: TakedownStatus
  readonly requestedBy: string
  readonly requestedByEmail: string | null
  readonly description: string
  readonly evidenceUrls: readonly string[]
  readonly reviewedBy: string | null
  readonly reviewNotes: string | null
  readonly executedAt: string | null
  readonly reinstatedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Streaming / Engagement ──────────────────────────────────────────────────

export interface StreamEvent {
  readonly id: string
  readonly orgId: string
  readonly listenerId: string | null
  readonly assetId: string
  readonly startedAt: string
  readonly endedAt: string | null
  readonly durationSeconds: number
  readonly quality: AudioQuality
  readonly protocol: StreamProtocol
  readonly deviceType: string | null
  readonly country: string | null
  readonly city: string | null
  readonly completionPercent: number
  readonly offline: boolean
}

export interface PlaybackSession {
  readonly id: string
  readonly listenerId: string
  readonly startedAt: string
  readonly lastActiveAt: string
  readonly trackQueue: readonly string[]
  readonly currentTrackIndex: number
  readonly currentPositionSeconds: number
  readonly state: PlaybackState
  readonly quality: AudioQuality
  readonly shuffleEnabled: boolean
  readonly repeatMode: 'off' | 'all' | 'one'
  readonly deviceId: string | null
}

export interface DownloadLicense {
  readonly id: string
  readonly listenerId: string
  readonly assetId: string
  readonly status: DownloadStatus
  readonly quality: AudioQuality
  readonly fileSizeBytes: number
  readonly downloadedAt: string | null
  readonly expiresAt: string
  readonly revokedAt: string | null
  readonly offlineKey: string | null
}

export interface OfflineAsset {
  readonly assetId: string
  readonly listenerId: string
  readonly quality: AudioQuality
  readonly fileSizeBytes: number
  readonly cachedAt: string
  readonly lastPlayedAt: string | null
  readonly syncedAt: string
}

export interface QueueState {
  readonly listenerId: string
  readonly tracks: readonly QueueTrack[]
  readonly currentIndex: number
  readonly shuffleEnabled: boolean
  readonly repeatMode: 'off' | 'all' | 'one'
  readonly updatedAt: string
}

export interface QueueTrack {
  readonly assetId: string
  readonly title: string
  readonly artistName: string
  readonly coverArtUrl: string | null
  readonly durationSeconds: number
  readonly addedAt: string
  readonly source: 'library' | 'search' | 'recommendation' | 'playlist' | 'album' | 'radio'
}

export interface RecentlyPlayed {
  readonly listenerId: string
  readonly assetId: string
  readonly playedAt: string
  readonly durationPlayed: number
  readonly context: string | null
}

// ── Analytics / Metrics ─────────────────────────────────────────────────────

export interface CreatorDailyMetric {
  readonly creatorId: string
  readonly date: string
  readonly streams: number
  readonly downloads: number
  readonly saves: number
  readonly shares: number
  readonly followers: number
  readonly followerDelta: number
  readonly revenue: number
  readonly currency: ZongaCurrency
  readonly topTrackId: string | null
  readonly topCountry: string | null
}

export interface TrackPerformanceSnapshot {
  readonly assetId: string
  readonly date: string
  readonly streams: number
  readonly downloads: number
  readonly saves: number
  readonly shares: number
  readonly skipRate: number
  readonly avgListenDuration: number
  readonly completionRate: number
  readonly playlistAdds: number
  readonly topCountry: string | null
  readonly topCity: string | null
}

export interface ListenerGrowthSnapshot {
  readonly creatorId: string
  readonly date: string
  readonly totalFollowers: number
  readonly newFollowers: number
  readonly unfollows: number
  readonly dailyActiveListeners: number
  readonly monthlyActiveListeners: number
  readonly topAcquisitionSource: string | null
}

// ── Payout (Extended) ───────────────────────────────────────────────────────

export interface PayoutAccount {
  readonly id: string
  readonly creatorId: string
  readonly rail: PayoutRail
  readonly accountRef: string
  readonly accountName: string | null
  readonly currency: ZongaCurrency
  readonly verified: boolean
  readonly primary: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

export interface EarningsLedger {
  readonly id: string
  readonly creatorId: string
  readonly period: string
  readonly grossEarnings: number
  readonly platformFees: number
  readonly netEarnings: number
  readonly currency: ZongaCurrency
  readonly splits: readonly EarningsLedgerSplit[]
  readonly lockedAt: string | null
  readonly createdAt: string
}

export interface EarningsLedgerSplit {
  readonly ownerId: string
  readonly ownerName: string
  readonly sharePercent: number
  readonly amount: number
}

export interface RoyaltyStatement {
  readonly id: string
  readonly creatorId: string
  readonly periodStart: string
  readonly periodEnd: string
  readonly totalStreams: number
  readonly totalDownloads: number
  readonly grossRevenue: number
  readonly platformFee: number
  readonly netRevenue: number
  readonly currency: ZongaCurrency
  readonly tracks: readonly RoyaltyStatementTrack[]
  readonly generatedAt: string
  readonly exportUrl: string | null
}

export interface RoyaltyStatementTrack {
  readonly assetId: string
  readonly title: string
  readonly streams: number
  readonly downloads: number
  readonly revenue: number
  readonly splitPercent: number
  readonly netAmount: number
}

export interface FraudReviewFlag {
  readonly id: string
  readonly orgId: string
  readonly signalType: FraudSignalType
  readonly entityType: string
  readonly targetEntityId: string
  readonly severity: 'low' | 'medium' | 'high' | 'critical'
  readonly score: number
  readonly explanation: string
  readonly autoBlocked: boolean
  readonly reviewedBy: string | null
  readonly reviewedAt: string | null
  readonly resolution: string | null
  readonly createdAt: string
}

// ── Governance / Compliance ─────────────────────────────────────────────────

export interface PolicyDecision {
  readonly id: string
  readonly orgId: string
  readonly entityType: string
  readonly entityId: string
  readonly policyName: string
  readonly decision: 'allow' | 'deny' | 'flag'
  readonly reason: string
  readonly actorId: string
  readonly metadata: Readonly<Record<string, unknown>>
  readonly createdAt: string
}

export interface ConsentRecord {
  readonly id: string
  readonly userId: string
  readonly consentType: ConsentType
  readonly granted: boolean
  readonly version: string
  readonly ipAddress: string | null
  readonly grantedAt: string
  readonly revokedAt: string | null
}

export interface ExportJob {
  readonly id: string
  readonly orgId: string
  readonly requestedBy: string
  readonly entityType: string
  readonly format: ExportFormat
  readonly status: ExportJobStatus
  readonly filters: Readonly<Record<string, unknown>>
  readonly resultUrl: string | null
  readonly rowCount: number | null
  readonly startedAt: string | null
  readonly completedAt: string | null
  readonly expiresAt: string | null
  readonly createdAt: string
}

// ── Events / Ticketing (Extended) ───────────────────────────────────────────

export interface EventSeries {
  readonly id: string
  readonly orgId: string
  readonly title: string
  readonly description: string | null
  readonly imageUrl: string | null
  readonly createdAt: string
}

export interface EventSession {
  readonly id: string
  readonly eventId: string
  readonly title: string
  readonly startsAt: string
  readonly endsAt: string
  readonly venue: string | null
  readonly capacity: number | null
}

export interface Venue {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly address: string | null
  readonly city: string
  readonly country: string
  readonly latitude: number | null
  readonly longitude: number | null
  readonly capacity: number | null
  readonly venueType: string | null
  readonly imageUrl: string | null
  readonly createdAt: string
}

export interface OrganizerProfile {
  readonly id: string
  readonly orgId: string
  readonly userId: string
  readonly displayName: string
  readonly bio: string | null
  readonly logoUrl: string | null
  readonly verified: boolean
  readonly createdAt: string
}

export interface TicketInventory {
  readonly ticketTypeId: string
  readonly totalQuantity: number
  readonly sold: number
  readonly held: number
  readonly available: number
  readonly lastUpdatedAt: string
}

export interface TicketOrder {
  readonly id: string
  readonly orgId: string
  readonly eventId: string
  readonly buyerId: string
  readonly items: readonly TicketOrderItem[]
  readonly totalAmount: number
  readonly currency: ZongaCurrency
  readonly status: TicketPurchaseStatus
  readonly paymentRef: string | null
  readonly promoCodeId: string | null
  readonly createdAt: string
}

export interface TicketOrderItem {
  readonly ticketTypeId: string
  readonly quantity: number
  readonly unitPrice: number
  readonly tierLabel: string
}

export interface TicketHolder {
  readonly id: string
  readonly orderId: string
  readonly ticketTypeId: string
  readonly eventId: string
  readonly holderId: string | null
  readonly holderName: string | null
  readonly holderEmail: string | null
  readonly qrCode: string
  readonly scanned: boolean
  readonly scannedAt: string | null
  readonly transferredTo: string | null
  readonly createdAt: string
}

export interface TicketTransfer {
  readonly id: string
  readonly ticketHolderId: string
  readonly fromUserId: string
  readonly toEmail: string
  readonly toUserId: string | null
  readonly status: TicketTransferStatus
  readonly initiatedAt: string
  readonly completedAt: string | null
}

export interface TicketRefund {
  readonly id: string
  readonly orderId: string
  readonly ticketHolderId: string | null
  readonly amount: number
  readonly currency: ZongaCurrency
  readonly reason: string
  readonly status: RefundStatus
  readonly processedBy: string | null
  readonly processedAt: string | null
  readonly createdAt: string
}

export interface TicketScan {
  readonly id: string
  readonly ticketHolderId: string
  readonly eventId: string
  readonly scannedBy: string
  readonly result: ScanResult
  readonly deviceId: string | null
  readonly scannedAt: string
  readonly latitude: number | null
  readonly longitude: number | null
  readonly offline: boolean
}

export interface PromoCode {
  readonly id: string
  readonly eventId: string
  readonly code: string
  readonly type: PromoCodeType
  readonly value: number
  readonly maxUses: number
  readonly currentUses: number
  readonly validFrom: string
  readonly validUntil: string
  readonly createdBy: string
  readonly createdAt: string
}

export interface WaitlistEntry {
  readonly id: string
  readonly eventId: string
  readonly ticketTypeId: string
  readonly userId: string
  readonly email: string
  readonly position: number
  readonly notifiedAt: string | null
  readonly convertedAt: string | null
  readonly createdAt: string
}

// ── Event Settlement / Finance ──────────────────────────────────────────────

export interface SettlementAccount {
  readonly id: string
  readonly organizerId: string
  readonly rail: PayoutRail
  readonly accountRef: string
  readonly currency: ZongaCurrency
  readonly verified: boolean
  readonly createdAt: string
}

export interface EventRevenueLedger {
  readonly id: string
  readonly eventId: string
  readonly ticketSales: number
  readonly refunds: number
  readonly chargebacks: number
  readonly platformFees: number
  readonly netRevenue: number
  readonly currency: ZongaCurrency
  readonly lastCalculatedAt: string
}

export interface EventPayout {
  readonly id: string
  readonly eventId: string
  readonly organizerId: string
  readonly amount: number
  readonly currency: ZongaCurrency
  readonly status: SettlementStatus
  readonly settlementAccountId: string | null
  readonly processedAt: string | null
  readonly createdAt: string
}

export interface PlatformFeeRule {
  readonly id: string
  readonly name: string
  readonly feePercent: number
  readonly fixedFee: number
  readonly currency: ZongaCurrency
  readonly appliesToEventType: EventType | null
  readonly minTicketPrice: number | null
  readonly maxTicketPrice: number | null
  readonly effectiveFrom: string
  readonly effectiveUntil: string | null
}

export interface ChargebackCase {
  readonly id: string
  readonly orderId: string
  readonly eventId: string
  readonly amount: number
  readonly currency: ZongaCurrency
  readonly status: ChargebackStatus
  readonly reason: string
  readonly externalRef: string | null
  readonly evidenceSubmittedAt: string | null
  readonly resolvedAt: string | null
  readonly createdAt: string
}

// ── Media Pipeline ──────────────────────────────────────────────────────────

export interface TranscodeJob {
  readonly id: string
  readonly assetId: string
  readonly sourceUrl: string
  readonly targetQualities: readonly AudioQuality[]
  readonly status: TranscodeJobStatus
  readonly progress: number
  readonly outputManifest: readonly TranscodeOutput[] | null
  readonly error: string | null
  readonly startedAt: string | null
  readonly completedAt: string | null
  readonly createdAt: string
}

export interface TranscodeOutput {
  readonly quality: AudioQuality
  readonly url: string
  readonly fileSizeBytes: number
  readonly durationSeconds: number
  readonly codec: string
  readonly bitrate: number
}

export interface AssetManifest {
  readonly assetId: string
  readonly originalUrl: string
  readonly coverArtUrl: string | null
  readonly waveformUrl: string | null
  readonly previewUrl: string | null
  readonly outputs: readonly TranscodeOutput[]
  readonly generatedAt: string
}

export interface StreamingToken {
  readonly token: string
  readonly assetId: string
  readonly listenerId: string | null
  readonly quality: AudioQuality
  readonly expiresAt: string
  readonly issuedAt: string
}

// ── Recommendation / AI ─────────────────────────────────────────────────────

export interface RecommendationRequest {
  readonly listenerId: string
  readonly type: RecommendationType
  readonly context: Readonly<Record<string, unknown>>
  readonly limit: number
  readonly excludeAssetIds: readonly string[]
}

export interface RecommendationResponse {
  readonly requestId: string
  readonly type: RecommendationType
  readonly items: readonly RecommendationItem[]
  readonly modelVersion: string | null
  readonly computedAt: string
  readonly featureFlags: readonly string[]
}

export interface RecommendationItem {
  readonly assetId: string
  readonly score: number
  readonly reason: string
  readonly metadata: Readonly<Record<string, unknown>>
}

export interface CreatorIntelligenceInsight {
  readonly creatorId: string
  readonly insightType: string
  readonly title: string
  readonly description: string
  readonly dataPoints: Readonly<Record<string, unknown>>
  readonly actionable: boolean
  readonly generatedAt: string
  readonly modelVersion: string | null
}

// ── Distribution ────────────────────────────────────────────────────────────

export interface DistributionRecord {
  readonly id: string
  readonly releaseId: string
  readonly target: DistributionTarget
  readonly status: 'pending' | 'submitted' | 'live' | 'rejected' | 'withdrawn'
  readonly externalId: string | null
  readonly submittedAt: string | null
  readonly liveAt: string | null
  readonly createdAt: string
}
