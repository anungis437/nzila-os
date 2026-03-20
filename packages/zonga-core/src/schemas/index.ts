/**
 * @nzila/zonga-core — Zod Validation Schemas
 *
 * API boundary validation for Zonga content platform orgs.
 *
 * @module @nzila/zonga-core/schemas
 */
import { z } from 'zod'
import {
  CreatorStatus as _CreatorStatus,
  AssetType,
  RevenueType,
  PayoutRail,
  ZongaRole,
  ZongaCurrency,
  ZongaLanguage,
  AudioQuality,
  EventStatus as _EventStatus,
  TicketPurchaseStatus as _TicketPurchaseStatus,
  PlaylistVisibility,
  PlaylistOwnerType,
  ModerationCaseType,
  ModerationCaseStatus,
  FavoriteEntityType,
  ListenerActivityType,
  NotificationType,
  RightsOwnerRole,
  SplitAgreementStatus,
  DisputeType,
  DisputeStatus,
  TakedownReason,
  TakedownStatus,
  DistributionTarget,
  EventType,
  TicketTier,
  PromoCodeType,
  MoodTag,
  RegionTag,
  VerificationType,
  ConsentType,
  ExportFormat,
  FraudSignalType,
  RecommendationType,
} from '../enums'

// ── Helpers ─────────────────────────────────────────────────────────────────

const enumValues = <T extends Record<string, string>>(e: T) =>
  Object.values(e) as [string, ...string[]]

// ── Creator ─────────────────────────────────────────────────────────────────

export const CreateCreatorSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().min(1).max(255),
  bio: z.string().max(2000).optional(),
  avatarUrl: z.string().url().optional(),
  genre: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  language: z.enum(enumValues(ZongaLanguage)).optional(),
  region: z.enum(['west', 'east', 'central', 'southern', 'north', 'diaspora']).optional(),
  payoutRail: z.enum(enumValues(PayoutRail)).optional(),
  payoutAccountRef: z.string().max(255).optional(),
  payoutCurrency: z.enum(enumValues(ZongaCurrency)).optional(),
})

export type CreateCreatorInput = z.infer<typeof CreateCreatorSchema>

// ── Content Asset ───────────────────────────────────────────────────────────

export const CreateContentAssetSchema = z.object({
  creatorId: z.string().uuid(),
  title: z.string().min(1).max(255),
  type: z.enum(enumValues(AssetType)),
  description: z.string().max(5000).optional(),
  genre: z.string().max(100).optional(),
  durationSeconds: z.number().int().min(0).optional(),
  language: z.enum(enumValues(ZongaLanguage)).optional(),
  collaborators: z.array(z.string().max(255)).max(20).optional(),
  isrc: z.string().max(15).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type CreateContentAssetInput = z.infer<typeof CreateContentAssetSchema>

export const PublishAssetSchema = z.object({
  assetId: z.string().uuid(),
  storageUrl: z.string().url(),
  coverArtUrl: z.string().url().optional(),
  audioFingerprint: z.string().optional(),
  qualityTiers: z.array(z.enum(enumValues(AudioQuality))).optional(),
})

export type PublishAssetInput = z.infer<typeof PublishAssetSchema>

// ── Release ─────────────────────────────────────────────────────────────────

/** Royalty split for a collaborator on a release. */
export const RoyaltySplitSchema = z.object({
  creatorId: z.string().uuid(),
  displayName: z.string().min(1).max(255),
  role: z.enum(['primary', 'featured', 'producer', 'songwriter']),
  sharePercent: z.number().min(0).max(100),
})

export type RoyaltySplitInput = z.infer<typeof RoyaltySplitSchema>

export const CreateReleaseSchema = z.object({
  creatorId: z.string().uuid(),
  title: z.string().min(1).max(255),
  releaseDate: z.string().datetime().optional(),
  royaltySplits: z.array(RoyaltySplitSchema).max(20).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type CreateReleaseInput = z.infer<typeof CreateReleaseSchema>

// ── Revenue Event ───────────────────────────────────────────────────────────

export const RecordRevenueEventSchema = z.object({
  creatorId: z.string().uuid(),
  assetId: z.string().uuid().optional(),
  type: z.enum(enumValues(RevenueType)),
  amount: z.number().min(0),
  currency: z.enum(enumValues(ZongaCurrency)).default('USD'),
  description: z.string().max(1000).optional(),
  externalRef: z.string().max(255).optional(),
  occurredAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type RecordRevenueEventInput = z.infer<typeof RecordRevenueEventSchema>

// ── Payout Preview ──────────────────────────────────────────────────────────

export const PayoutPreviewRequestSchema = z.object({
  creatorId: z.string().uuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  platformFeePercent: z.number().min(0).max(100).default(15),
  payoutRail: z.enum(enumValues(PayoutRail)).optional(),
  payoutCurrency: z.enum(enumValues(ZongaCurrency)).optional(),
})

export type PayoutPreviewRequestInput = z.infer<typeof PayoutPreviewRequestSchema>

// ── Audio Upload ────────────────────────────────────────────────────────────

/** Validates caller-supplied metadata for an audio file upload. */
export const AudioUploadMetaSchema = z.object({
  creatorId: z.string().uuid(),
  assetId: z.string().uuid(),
  fileName: z.string().min(1).max(500),
  contentType: z.enum([
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/wav',
    'audio/flac',
    'audio/ogg',
    'audio/webm',
  ]),
  fileSizeBytes: z.number().int().min(1).max(500_000_000), // 500 MB limit
})

export type AudioUploadMetaInput = z.infer<typeof AudioUploadMetaSchema>

// ── Org Context ─────────────────────────────────────────────────────────────

export const ZongaOrgContextSchema = z.object({
  orgId: z.string().uuid(),
  actorId: z.string().uuid(),
  role: z.enum(enumValues(ZongaRole)),
  permissions: z.array(z.string()),
  requestId: z.string().min(1),
})

// ── Listener ────────────────────────────────────────────────────────────────

export const CreateListenerSchema = z.object({
  displayName: z.string().min(1).max(255),
  email: z.string().email().optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  preferencesJson: z.record(z.unknown()).optional(),
})
export type CreateListenerInput = z.infer<typeof CreateListenerSchema>

export const ListenerFollowSchema = z.object({
  listenerId: z.string().uuid(),
  creatorId: z.string().uuid(),
})
export type ListenerFollowInput = z.infer<typeof ListenerFollowSchema>

export const ListenerFavoriteSchema = z.object({
  listenerId: z.string().uuid(),
  entityType: z.enum(enumValues(FavoriteEntityType)),
  targetEntityId: z.string().uuid(),
})
export type ListenerFavoriteInput = z.infer<typeof ListenerFavoriteSchema>

export const ListenerActivitySchema = z.object({
  listenerId: z.string().uuid(),
  activityType: z.enum(enumValues(ListenerActivityType)),
  entityType: z.string().max(50).optional(),
  targetEntityId: z.string().uuid().optional(),
  metadataJson: z.record(z.unknown()).optional(),
})
export type ListenerActivityInput = z.infer<typeof ListenerActivitySchema>

// ── Event ──────────────────────────────────────────────────────────────────

export const CreateEventSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  venue: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  creatorId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
})
export type CreateEventInput = z.infer<typeof CreateEventSchema>

export const CreateTicketTypeSchema = z.object({
  eventId: z.string().uuid(),
  ticketType: z.string().min(1).max(100),
  price: z.number().min(0),
  currency: z.enum(enumValues(ZongaCurrency)).default('USD'),
  quantityAvailable: z.number().int().min(0),
})
export type CreateTicketTypeInput = z.infer<typeof CreateTicketTypeSchema>

export const PurchaseTicketSchema = z.object({
  eventId: z.string().uuid(),
  ticketTypeId: z.string().uuid(),
  listenerId: z.string().uuid().optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
})
export type PurchaseTicketInput = z.infer<typeof PurchaseTicketSchema>

// ── Playlist ────────────────────────────────────────────────────────────────

export const CreatePlaylistSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  ownerType: z.enum(enumValues(PlaylistOwnerType)),
  ownerId: z.string().uuid(),
  visibility: z.enum(enumValues(PlaylistVisibility)).default('public'),
})
export type CreatePlaylistInput = z.infer<typeof CreatePlaylistSchema>

export const AddPlaylistItemSchema = z.object({
  playlistId: z.string().uuid(),
  entityType: z.enum(['track', 'release']),
  targetEntityId: z.string().uuid(),
  position: z.number().int().min(0),
})
export type AddPlaylistItemInput = z.infer<typeof AddPlaylistItemSchema>

// ── Moderation ──────────────────────────────────────────────────────────────

export const CreateModerationCaseSchema = z.object({
  entityType: z.enum(['creator', 'asset', 'release', 'event']),
  targetEntityId: z.string().uuid(),
  caseType: z.enum(enumValues(ModerationCaseType)),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']).default('medium'),
  notes: z.string().max(5000).optional(),
  assignedTo: z.string().uuid().optional(),
})
export type CreateModerationCaseInput = z.infer<typeof CreateModerationCaseSchema>

export const ResolveModerationCaseSchema = z.object({
  caseId: z.string().uuid(),
  resolution: z.enum(['resolved', 'dismissed', 'escalated']),
  notes: z.string().max(5000).optional(),
})
export type ResolveModerationCaseInput = z.infer<typeof ResolveModerationCaseSchema>

// ── Notification ────────────────────────────────────────────────────────────

export const CreateNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(enumValues(NotificationType)),
  title: z.string().min(1).max(500),
  body: z.string().max(5000).optional(),
  link: z.string().max(2000).optional(),
})
export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>

// ── Rights / Ownership ──────────────────────────────────────────────────────

export const CreateRightsOwnerSchema = z.object({
  name: z.string().min(1).max(255),
  entityType: z.enum(['individual', 'label', 'publisher', 'collective']),
  contactEmail: z.string().email().optional(),
  country: z.string().max(100).optional(),
  ipiNumber: z.string().max(20).optional(),
})
export type CreateRightsOwnerInput = z.infer<typeof CreateRightsOwnerSchema>

export const CreateRightsShareSchema = z.object({
  assetId: z.string().uuid(),
  ownerId: z.string().uuid(),
  ownerRole: z.enum(enumValues(RightsOwnerRole)),
  sharePercent: z.number().min(0).max(100),
  territory: z.string().max(100).default('WORLDWIDE'),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime().optional(),
})
export type CreateRightsShareInput = z.infer<typeof CreateRightsShareSchema>

export const CreateSplitAgreementSchema = z.object({
  releaseId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  shares: z.array(z.object({
    ownerId: z.string().uuid(),
    ownerName: z.string().min(1).max(255),
    role: z.enum(enumValues(RightsOwnerRole)),
    sharePercent: z.number().min(0).max(100),
  })).min(1).max(20),
  effectiveDate: z.string().datetime(),
  expiryDate: z.string().datetime().optional(),
})
export type CreateSplitAgreementInput = z.infer<typeof CreateSplitAgreementSchema>

// ── Disputes / Takedowns ────────────────────────────────────────────────────

export const CreateDisputeSchema = z.object({
  disputeType: z.enum(enumValues(DisputeType)),
  respondentId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  releaseId: z.string().uuid().optional(),
  description: z.string().min(10).max(5000),
  evidenceUrls: z.array(z.string().url()).max(10).optional(),
})
export type CreateDisputeInput = z.infer<typeof CreateDisputeSchema>

export const ResolveDisputeSchema = z.object({
  disputeId: z.string().uuid(),
  resolution: z.enum(enumValues(DisputeStatus)),
  notes: z.string().max(5000).optional(),
  payoutBlockActive: z.boolean().optional(),
})
export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>

export const CreateTakedownSchema = z.object({
  assetId: z.string().uuid().optional(),
  releaseId: z.string().uuid().optional(),
  reason: z.enum(enumValues(TakedownReason)),
  description: z.string().min(10).max(5000),
  requestedByEmail: z.string().email().optional(),
  evidenceUrls: z.array(z.string().url()).max(10).optional(),
})
export type CreateTakedownInput = z.infer<typeof CreateTakedownSchema>

// ── Streaming ───────────────────────────────────────────────────────────────

export const RecordStreamEventSchema = z.object({
  assetId: z.string().uuid(),
  listenerId: z.string().uuid().optional(),
  durationSeconds: z.number().int().min(0),
  quality: z.enum(enumValues(AudioQuality)),
  completionPercent: z.number().min(0).max(100),
  deviceType: z.string().max(50).optional(),
  country: z.string().max(5).optional(),
  city: z.string().max(100).optional(),
  offline: z.boolean().default(false),
})
export type RecordStreamEventInput = z.infer<typeof RecordStreamEventSchema>

export const RequestDownloadSchema = z.object({
  assetId: z.string().uuid(),
  listenerId: z.string().uuid(),
  quality: z.enum(enumValues(AudioQuality)),
})
export type RequestDownloadInput = z.infer<typeof RequestDownloadSchema>

// ── Events (Extended) ───────────────────────────────────────────────────────

export const CreateEventExtendedSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  eventType: z.enum(enumValues(EventType)),
  venueId: z.string().uuid().optional(),
  venue: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  creatorId: z.string().uuid().optional(),
  seriesId: z.string().uuid().optional(),
  imageUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
})
export type CreateEventExtendedInput = z.infer<typeof CreateEventExtendedSchema>

export const CreateTicketTypeExtendedSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().min(1).max(100),
  tier: z.enum(enumValues(TicketTier)),
  price: z.number().min(0),
  currency: z.enum(enumValues(ZongaCurrency)).default('USD'),
  quantityAvailable: z.number().int().min(0),
  salesStart: z.string().datetime().optional(),
  salesEnd: z.string().datetime().optional(),
  maxPerOrder: z.number().int().min(1).max(20).default(10),
  description: z.string().max(500).optional(),
})
export type CreateTicketTypeExtendedInput = z.infer<typeof CreateTicketTypeExtendedSchema>

export const CreatePromoCodeSchema = z.object({
  eventId: z.string().uuid(),
  code: z.string().min(3).max(30).regex(/^[A-Z0-9_-]+$/),
  type: z.enum(enumValues(PromoCodeType)),
  value: z.number().min(0),
  maxUses: z.number().int().min(1).max(10000),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
})
export type CreatePromoCodeInput = z.infer<typeof CreatePromoCodeSchema>

export const TicketTransferSchema = z.object({
  ticketHolderId: z.string().uuid(),
  toEmail: z.string().email(),
})
export type TicketTransferInput = z.infer<typeof TicketTransferSchema>

export const TicketRefundSchema = z.object({
  orderId: z.string().uuid(),
  ticketHolderId: z.string().uuid().optional(),
  reason: z.string().min(5).max(1000),
})
export type TicketRefundInput = z.infer<typeof TicketRefundSchema>

export const TicketScanSchema = z.object({
  ticketHolderId: z.string().uuid(),
  eventId: z.string().uuid(),
  deviceId: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  offline: z.boolean().default(false),
})
export type TicketScanInput = z.infer<typeof TicketScanSchema>

export const CreateVenueSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().max(500).optional(),
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
  capacity: z.number().int().min(1).optional(),
  venueType: z.string().max(50).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})
export type CreateVenueInput = z.infer<typeof CreateVenueSchema>

// ── Creator Verification ────────────────────────────────────────────────────

export const CreateVerificationSchema = z.object({
  creatorId: z.string().uuid(),
  verificationType: z.enum(enumValues(VerificationType)),
  evidenceUrls: z.array(z.string().url()).min(1).max(5),
})
export type CreateVerificationInput = z.infer<typeof CreateVerificationSchema>

// ── Payout Account ──────────────────────────────────────────────────────────

export const CreatePayoutAccountSchema = z.object({
  creatorId: z.string().uuid(),
  rail: z.enum(enumValues(PayoutRail)),
  accountRef: z.string().min(1).max(255),
  accountName: z.string().max(255).optional(),
  currency: z.enum(enumValues(ZongaCurrency)),
})
export type CreatePayoutAccountInput = z.infer<typeof CreatePayoutAccountSchema>

// ── Editorial Collection ────────────────────────────────────────────────────

export const CreateEditorialCollectionSchema = z.object({
  title: z.string().min(1).max(255),
  subtitle: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  coverImageUrl: z.string().url().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  moodTags: z.array(z.enum(enumValues(MoodTag))).max(5).optional(),
  regionTags: z.array(z.enum(enumValues(RegionTag))).max(5).optional(),
})
export type CreateEditorialCollectionInput = z.infer<typeof CreateEditorialCollectionSchema>

// ── Label ──────────────────────────────────────────────────────────────────

export const CreateLabelSchema = z.object({
  name: z.string().min(1).max(255),
  displayName: z.string().min(1).max(255),
  website: z.string().url().optional(),
  country: z.string().max(100).optional(),
  contactEmail: z.string().email().optional(),
})
export type CreateLabelInput = z.infer<typeof CreateLabelSchema>

// ── Consent ─────────────────────────────────────────────────────────────────

export const RecordConsentSchema = z.object({
  userId: z.string().uuid(),
  consentType: z.enum(enumValues(ConsentType)),
  granted: z.boolean(),
  version: z.string().min(1).max(20),
})
export type RecordConsentInput = z.infer<typeof RecordConsentSchema>

// ── Export ───────────────────────────────────────────────────────────────────

export const CreateExportJobSchema = z.object({
  entityType: z.enum(['revenue', 'payouts', 'streams', 'listeners', 'moderation', 'events']),
  format: z.enum(enumValues(ExportFormat)),
  filters: z.record(z.unknown()).optional(),
})
export type CreateExportJobInput = z.infer<typeof CreateExportJobSchema>

// ── Fraud Review ────────────────────────────────────────────────────────────

export const CreateFraudReviewSchema = z.object({
  signalType: z.enum(enumValues(FraudSignalType)),
  entityType: z.enum(['creator', 'asset', 'listener', 'payout', 'event']),
  targetEntityId: z.string().uuid(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  score: z.number().min(0).max(100),
  explanation: z.string().min(5).max(2000),
})
export type CreateFraudReviewInput = z.infer<typeof CreateFraudReviewSchema>

// ── Recommendation ──────────────────────────────────────────────────────────

export const RecommendationRequestSchema = z.object({
  listenerId: z.string().uuid(),
  type: z.enum(enumValues(RecommendationType)),
  limit: z.number().int().min(1).max(100).default(20),
  excludeAssetIds: z.array(z.string().uuid()).max(100).optional(),
  context: z.record(z.unknown()).optional(),
})
export type RecommendationRequestInput = z.infer<typeof RecommendationRequestSchema>

// ── Distribution ────────────────────────────────────────────────────────────

export const CreateDistributionSchema = z.object({
  releaseId: z.string().uuid(),
  target: z.enum(enumValues(DistributionTarget)),
})
export type CreateDistributionInput = z.infer<typeof CreateDistributionSchema>
