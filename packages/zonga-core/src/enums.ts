/**
 * @nzila/zonga-core — Enums & Status Codes
 *
 * Content platform domain enumerations.
 * No DB, no framework — pure TypeScript.
 *
 * @module @nzila/zonga-core/enums
 */

// ── Creator ─────────────────────────────────────────────────────────────────

export const CreatorStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DEACTIVATED: 'deactivated',
} as const
export type CreatorStatus = (typeof CreatorStatus)[keyof typeof CreatorStatus]

export const CreatorOnboardingStatus = {
  INVITED: 'invited',
  REGISTERED: 'registered',
  PROFILE_COMPLETE: 'profile_complete',
  PAYOUT_READY: 'payout_ready',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} as const
export type CreatorOnboardingStatus = (typeof CreatorOnboardingStatus)[keyof typeof CreatorOnboardingStatus]

// ── Content Asset ───────────────────────────────────────────────────────────

export const AssetType = {
  TRACK: 'track',
  ALBUM: 'album',
  VIDEO: 'video',
  PODCAST: 'podcast',
} as const
export type AssetType = (typeof AssetType)[keyof typeof AssetType]

export const AssetStatus = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  REVIEW: 'review',
  PUBLISHED: 'published',
  TAKEN_DOWN: 'taken_down',
  ARCHIVED: 'archived',
} as const
export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus]

// ── Release ─────────────────────────────────────────────────────────────────

export const ReleaseStatus = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  RELEASED: 'released',
  HELD: 'held',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
  WITHDRAWN: 'withdrawn',
} as const
export type ReleaseStatus = (typeof ReleaseStatus)[keyof typeof ReleaseStatus]

export const ReleaseType = {
  SINGLE: 'single',
  EP: 'ep',
  ALBUM: 'album',
} as const
export type ReleaseType = (typeof ReleaseType)[keyof typeof ReleaseType]

// ── Revenue ─────────────────────────────────────────────────────────────────

export const RevenueType = {
  STREAM: 'stream',
  DOWNLOAD: 'download',
  TIP: 'tip',
  SUBSCRIPTION_SHARE: 'subscription_share',
  TICKET_SALE: 'ticket_sale',
  MERCHANDISE: 'merchandise',
  SYNC_LICENSE: 'sync_license',
} as const
export type RevenueType = (typeof RevenueType)[keyof typeof RevenueType]

// ── Payout ──────────────────────────────────────────────────────────────────

export const PayoutStatus = {
  PENDING: 'pending',
  PREVIEWED: 'previewed',
  APPROVED: 'approved',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus]

// ── Payout Rail — how the creator receives money ────────────────────────────

export const PayoutRail = {
  STRIPE_CONNECT: 'stripe_connect',
  MPESA: 'mpesa',
  MTN_MOMO: 'mtn_momo',
  AIRTEL_MONEY: 'airtel_money',
  ORANGE_MONEY: 'orange_money',
  BANK_TRANSFER: 'bank_transfer',
  CHIPPER_CASH: 'chipper_cash',
  FLUTTERWAVE: 'flutterwave',
} as const
export type PayoutRail = (typeof PayoutRail)[keyof typeof PayoutRail]

// ── Event ───────────────────────────────────────────────────────────────────

export const EventStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  SOLD_OUT: 'sold_out',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus]

export const TicketPurchaseStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
} as const
export type TicketPurchaseStatus = (typeof TicketPurchaseStatus)[keyof typeof TicketPurchaseStatus]

// ── Playlist ────────────────────────────────────────────────────────────────

export const PlaylistVisibility = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  UNLISTED: 'unlisted',
} as const
export type PlaylistVisibility = (typeof PlaylistVisibility)[keyof typeof PlaylistVisibility]

export const PlaylistOwnerType = {
  SYSTEM: 'system',
  CREATOR: 'creator',
  LISTENER: 'listener',
} as const
export type PlaylistOwnerType = (typeof PlaylistOwnerType)[keyof typeof PlaylistOwnerType]

// ── Listener Activity ──────────────────────────────────────────────────────

export const ListenerActivityType = {
  VIEW: 'view',
  PLAY: 'play',
  FOLLOW: 'follow',
  FAVORITE: 'favorite',
  SAVE_PLAYLIST: 'save_playlist',
  BUY_TICKET: 'buy_ticket',
  SHARE: 'share',
} as const
export type ListenerActivityType = (typeof ListenerActivityType)[keyof typeof ListenerActivityType]

export const FavoriteEntityType = {
  TRACK: 'track',
  RELEASE: 'release',
  PLAYLIST: 'playlist',
  EVENT: 'event',
} as const
export type FavoriteEntityType = (typeof FavoriteEntityType)[keyof typeof FavoriteEntityType]

// ── Moderation ──────────────────────────────────────────────────────────────

export const ModerationCaseStatus = {
  OPEN: 'open',
  IN_REVIEW: 'in_review',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
  ESCALATED: 'escalated',
} as const
export type ModerationCaseStatus = (typeof ModerationCaseStatus)[keyof typeof ModerationCaseStatus]

export const ModerationCaseType = {
  COPYRIGHT: 'copyright',
  ABUSE: 'abuse',
  QUALITY: 'quality',
  POLICY: 'policy',
  FRAUD: 'fraud',
  OTHER: 'other',
} as const
export type ModerationCaseType = (typeof ModerationCaseType)[keyof typeof ModerationCaseType]

export const ModerationEntityType = {
  CREATOR: 'creator',
  ASSET: 'asset',
  RELEASE: 'release',
  EVENT: 'event',
} as const
export type ModerationEntityType = (typeof ModerationEntityType)[keyof typeof ModerationEntityType]

// ── Payout Preview ─────────────────────────────────────────────────────────

export const PayoutPreviewStatus = {
  DRAFT: 'draft',
  READY: 'ready',
  LOCKED: 'locked',
} as const
export type PayoutPreviewStatus = (typeof PayoutPreviewStatus)[keyof typeof PayoutPreviewStatus]

// ── Notification ────────────────────────────────────────────────────────────

export const NotificationType = {
  NEW_RELEASE: 'new_release',
  EVENT_REMINDER: 'event_reminder',
  TICKET_CONFIRMED: 'ticket_confirmed',
  PAYOUT_COMPLETED: 'payout_completed',
  MODERATION_ACTION: 'moderation_action',
  SYSTEM: 'system',
} as const
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType]

// ── Ledger ──────────────────────────────────────────────────────────────────

export const LedgerEntryType = {
  CREDIT: 'credit',
  DEBIT: 'debit',
  HOLD: 'hold',
  RELEASE: 'release',
} as const
export type LedgerEntryType = (typeof LedgerEntryType)[keyof typeof LedgerEntryType]

// ── Zonga Role (org-scoped) ─────────────────────────────────────────────────

export const ZongaRole = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CREATOR: 'creator',
  VIEWER: 'viewer',
} as const
export type ZongaRole = (typeof ZongaRole)[keyof typeof ZongaRole]

// ── African Currencies ──────────────────────────────────────────────────────

/**
 * Supported currencies. Platform-wide default is USD but creators
 * earn and are paid in their local currency where possible.
 */
export const ZongaCurrency = {
  USD: 'USD',
  CAD: 'CAD',
  EUR: 'EUR',
  GBP: 'GBP',
  // ── West Africa ──
  NGN: 'NGN', // Nigerian Naira
  XOF: 'XOF', // CFA Franc BCEAO (Senegal, Mali, Côte d'Ivoire, Burkina Faso, Benin, Togo, Niger, Guinea-Bissau)
  GHS: 'GHS', // Ghanaian Cedi
  // ── East Africa ──
  KES: 'KES', // Kenyan Shilling
  TZS: 'TZS', // Tanzanian Shilling
  UGX: 'UGX', // Ugandan Shilling
  ETB: 'ETB', // Ethiopian Birr
  RWF: 'RWF', // Rwandan Franc
  // ── Central Africa ──
  XAF: 'XAF', // CFA Franc BEAC (Cameroon, Congo, Gabon, Chad, CAR, Equatorial Guinea)
  CDF: 'CDF', // Congolese Franc (DRC)
  // ── Southern Africa ──
  ZAR: 'ZAR', // South African Rand
  BWP: 'BWP', // Botswana Pula
  ZMW: 'ZMW', // Zambian Kwacha
  // ── North Africa ──
  MAD: 'MAD', // Moroccan Dirham
  EGP: 'EGP', // Egyptian Pound
} as const
export type ZongaCurrency = (typeof ZongaCurrency)[keyof typeof ZongaCurrency]

// ── African Genre Taxonomy ──────────────────────────────────────────────────

/**
 * Curated genre taxonomy for African music. Organized by region.
 * Creators may also supply free-text sub-genres via metadata.
 */
export const AfricanGenre = {
  // ── Pan-African / Global ──
  AFROBEATS: 'afrobeats',
  AFROPOP: 'afropop',
  AFRO_SOUL: 'afro_soul',
  AFRO_RNB: 'afro_rnb',
  AFRO_HOUSE: 'afro_house',
  AFRO_JAZZ: 'afro_jazz',
  AFRO_FUSION: 'afro_fusion',
  AFRO_GOSPEL: 'afro_gospel',
  AFRO_HIP_HOP: 'afro_hip_hop',
  AFRO_DANCEHALL: 'afro_dancehall',
  AFRO_TRAP: 'afro_trap',
  AFRO_CLASSICAL: 'afro_classical',

  // ── West Africa ──
  HIGHLIFE: 'highlife',
  JUJU: 'juju',
  FUJI: 'fuji',
  APALA: 'apala',
  HIPLIFE: 'hiplife',
  AZONTO: 'azonto',
  PALM_WINE: 'palm_wine',
  MBALAX: 'mbalax',
  WASSOULOU: 'wassoulou',
  GRIOT: 'griot',
  COUPE_DECALE: 'coupe_decale',
  ZOUGLOU: 'zouglou',

  // ── East Africa ──
  BONGO_FLAVA: 'bongo_flava',
  GENGETONE: 'gengetone',
  BENGA: 'benga',
  TAARAB: 'taarab',
  OHANGLA: 'ohangla',
  MUGITHI: 'mugithi',
  KADONGO_KAMU: 'kadongo_kamu',
  ETHIO_JAZZ: 'ethio_jazz',

  // ── Central Africa ──
  NDOMBOLO: 'ndombolo',
  SOUKOUS: 'soukous',
  RUMBA_CONGOLAISE: 'rumba_congolaise',
  MAKOSSA: 'makossa',
  BIKUTSI: 'bikutsi',
  BEND_SKIN: 'bend_skin',

  // ── Southern Africa ──
  AMAPIANO: 'amapiano',
  GQOM: 'gqom',
  KWAITO: 'kwaito',
  MASKANDI: 'maskandi',
  MARRABENTA: 'marrabenta',
  CHIMURENGA: 'chimurenga',
  SUNGURA: 'sungura',
  KIZOMBA: 'kizomba',
  SEMBA: 'semba',
  KUDURO: 'kuduro',

  // ── North Africa ──
  RAI: 'rai',
  GNAWA: 'gnawa',
  CHAABI: 'chaabi',
  MAHRAGANAT: 'mahraganat',

  // ── Diaspora / Contemporary ──
  ALTÉ: 'alté',
  DRILL_AFRO: 'drill_afro',
  AMAPIANO_TECH: 'amapiano_tech',
  AFRO_ELECTRONIC: 'afro_electronic',

  // ── Non-African (for international content) ──
  POP: 'pop',
  HIP_HOP: 'hip_hop',
  RNB: 'rnb',
  GOSPEL: 'gospel',
  JAZZ: 'jazz',
  REGGAE: 'reggae',
  DANCEHALL: 'dancehall',
  ELECTRONIC: 'electronic',
  CLASSICAL: 'classical',
  OTHER: 'other',
} as const
export type AfricanGenre = (typeof AfricanGenre)[keyof typeof AfricanGenre]

// ── Audio Quality Tier ──────────────────────────────────────────────────────

/**
 * Audio quality tiers for bandwidth-sensitive African markets.
 * Lower tiers preserve data while maintaining acceptable quality.
 */
export const AudioQuality = {
  LOW: 'low',       // 32 kbps — 2G / extreme data saving
  MEDIUM: 'medium', // 64 kbps — 3G / balanced
  HIGH: 'high',     // 128 kbps — standard
  LOSSLESS: 'lossless', // 320 kbps / FLAC — Wi-Fi / premium
} as const
export type AudioQuality = (typeof AudioQuality)[keyof typeof AudioQuality]

// ── Supported Languages ─────────────────────────────────────────────────────

/**
 * Supported content/metadata languages for African markets.
 * These are the languages in which content metadata (titles, descriptions)
 * and the platform UI can be localized.
 */
export const ZongaLanguage = {
  // ── International ──
  EN: 'en',   // English
  FR: 'fr',   // French (West/Central Africa)
  PT: 'pt',   // Portuguese (Lusophone Africa)
  AR: 'ar',   // Arabic (North Africa)
  ES: 'es',   // Spanish (Equatorial Guinea)

  // ── Major African Languages ──
  SW: 'sw',   // Swahili (East Africa)
  YO: 'yo',   // Yoruba (Nigeria)
  IG: 'ig',   // Igbo (Nigeria)
  HA: 'ha',   // Hausa (Nigeria, Niger, Ghana)
  AM: 'am',   // Amharic (Ethiopia)
  ZU: 'zu',   // Zulu (South Africa)
  XH: 'xh',   // Xhosa (South Africa)
  RW: 'rw',   // Kinyarwanda (Rwanda)
  LN: 'ln',   // Lingala (DRC, Congo)
  WO: 'wo',   // Wolof (Senegal)
  TW: 'tw',   // Twi/Akan (Ghana)
  SO: 'so',   // Somali
  TI: 'ti',   // Tigrinya (Eritrea, Ethiopia)
} as const
export type ZongaLanguage = (typeof ZongaLanguage)[keyof typeof ZongaLanguage]

// ── African Country Codes (ISO 3166-1 alpha-2) ─────────────────────────────

/**
 * African countries for creator registration, listener demographics,
 * and payout rail availability.
 */
export const AfricanCountry = {
  // West Africa
  NG: 'NG', // Nigeria
  GH: 'GH', // Ghana
  SN: 'SN', // Senegal
  CI: 'CI', // Côte d'Ivoire
  ML: 'ML', // Mali
  BF: 'BF', // Burkina Faso
  NE: 'NE', // Niger
  BJ: 'BJ', // Benin
  TG: 'TG', // Togo
  GN: 'GN', // Guinea
  SL: 'SL', // Sierra Leone
  LR: 'LR', // Liberia
  GM: 'GM', // Gambia
  GW: 'GW', // Guinea-Bissau
  CV: 'CV', // Cabo Verde

  // East Africa
  KE: 'KE', // Kenya
  TZ: 'TZ', // Tanzania
  UG: 'UG', // Uganda
  ET: 'ET', // Ethiopia
  RW: 'RW', // Rwanda
  BI: 'BI', // Burundi
  SO: 'SO', // Somalia
  ER: 'ER', // Eritrea
  DJ: 'DJ', // Djibouti
  SS: 'SS', // South Sudan

  // Central Africa
  CD: 'CD', // DRC (Congo-Kinshasa)
  CG: 'CG', // Congo-Brazzaville
  CM: 'CM', // Cameroon
  GA: 'GA', // Gabon
  TD: 'TD', // Chad
  CF: 'CF', // Central African Republic
  GQ: 'GQ', // Equatorial Guinea

  // Southern Africa
  ZA: 'ZA', // South Africa
  BW: 'BW', // Botswana
  ZM: 'ZM', // Zambia
  ZW: 'ZW', // Zimbabwe
  MZ: 'MZ', // Mozambique
  AO: 'AO', // Angola
  NA: 'NA', // Namibia
  MW: 'MW', // Malawi
  LS: 'LS', // Lesotho
  SZ: 'SZ', // Eswatini
  MG: 'MG', // Madagascar
  MU: 'MU', // Mauritius

  // North Africa
  MA: 'MA', // Morocco
  EG: 'EG', // Egypt
  DZ: 'DZ', // Algeria
  TN: 'TN', // Tunisia
  LY: 'LY', // Libya
  SD: 'SD', // Sudan
} as const
export type AfricanCountry = (typeof AfricanCountry)[keyof typeof AfricanCountry]

// ── Streaming / Playback ────────────────────────────────────────────────────

export const StreamProtocol = {
  PROGRESSIVE: 'progressive',
  HLS: 'hls',
  DASH: 'dash',
} as const
export type StreamProtocol = (typeof StreamProtocol)[keyof typeof StreamProtocol]

export const PlaybackState = {
  IDLE: 'idle',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  BUFFERING: 'buffering',
  ENDED: 'ended',
  ERROR: 'error',
} as const
export type PlaybackState = (typeof PlaybackState)[keyof typeof PlaybackState]

export const DownloadStatus = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
} as const
export type DownloadStatus = (typeof DownloadStatus)[keyof typeof DownloadStatus]

// ── Rights / Ownership ──────────────────────────────────────────────────────

export const RightsOwnerRole = {
  MASTER: 'master',
  PUBLISHER: 'publisher',
  COMPOSER: 'composer',
  LYRICIST: 'lyricist',
  PERFORMER: 'performer',
  PRODUCER: 'producer',
  LABEL: 'label',
} as const
export type RightsOwnerRole = (typeof RightsOwnerRole)[keyof typeof RightsOwnerRole]

export const SplitAgreementStatus = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  ACTIVE: 'active',
  DISPUTED: 'disputed',
  SUPERSEDED: 'superseded',
  TERMINATED: 'terminated',
} as const
export type SplitAgreementStatus = (typeof SplitAgreementStatus)[keyof typeof SplitAgreementStatus]

export const DisputeStatus = {
  OPEN: 'open',
  UNDER_REVIEW: 'under_review',
  EVIDENCE_REQUESTED: 'evidence_requested',
  MEDIATION: 'mediation',
  RESOLVED_FOR_CLAIMANT: 'resolved_for_claimant',
  RESOLVED_FOR_RESPONDENT: 'resolved_for_respondent',
  DISMISSED: 'dismissed',
  APPEALED: 'appealed',
} as const
export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus]

export const DisputeType = {
  OWNERSHIP: 'ownership',
  SPLIT_PERCENTAGE: 'split_percentage',
  UNAUTHORIZED_USE: 'unauthorized_use',
  TAKEDOWN: 'takedown',
  PAYOUT: 'payout',
  METADATA: 'metadata',
} as const
export type DisputeType = (typeof DisputeType)[keyof typeof DisputeType]

export const TakedownReason = {
  COPYRIGHT_INFRINGEMENT: 'copyright_infringement',
  TRADEMARK_VIOLATION: 'trademark_violation',
  EXPLICIT_CONTENT: 'explicit_content',
  HATE_SPEECH: 'hate_speech',
  COURT_ORDER: 'court_order',
  RIGHTS_HOLDER_REQUEST: 'rights_holder_request',
  FRAUD: 'fraud',
  POLICY_VIOLATION: 'policy_violation',
} as const
export type TakedownReason = (typeof TakedownReason)[keyof typeof TakedownReason]

export const TakedownStatus = {
  REQUESTED: 'requested',
  UNDER_REVIEW: 'under_review',
  EXECUTED: 'executed',
  COUNTER_NOTICE_FILED: 'counter_notice_filed',
  REINSTATED: 'reinstated',
  PERMANENT: 'permanent',
} as const
export type TakedownStatus = (typeof TakedownStatus)[keyof typeof TakedownStatus]

// ── Distribution ────────────────────────────────────────────────────────────

export const DistributionTarget = {
  ZONGA: 'zonga',
  SPOTIFY: 'spotify',
  APPLE_MUSIC: 'apple_music',
  YOUTUBE_MUSIC: 'youtube_music',
  DEEZER: 'deezer',
  TIDAL: 'tidal',
  BOOMPLAY: 'boomplay',
  AUDIOMACK: 'audiomack',
  MDUNDO: 'mdundo',
} as const
export type DistributionTarget = (typeof DistributionTarget)[keyof typeof DistributionTarget]

// ── Events / Ticketing (Extended) ───────────────────────────────────────────

export const EventType = {
  CONCERT: 'concert',
  FESTIVAL: 'festival',
  ALBUM_LAUNCH: 'album_launch',
  CLUB_NIGHT: 'club_night',
  SHOWCASE: 'showcase',
  LISTENING_PARTY: 'listening_party',
  VIRTUAL: 'virtual',
  WORKSHOP: 'workshop',
  MEET_AND_GREET: 'meet_and_greet',
} as const
export type EventType = (typeof EventType)[keyof typeof EventType]

export const TicketTier = {
  EARLY_BIRD: 'early_bird',
  GENERAL: 'general',
  VIP: 'vip',
  VVIP: 'vvip',
  BACKSTAGE: 'backstage',
  TABLE: 'table',
  COMP: 'comp',
} as const
export type TicketTier = (typeof TicketTier)[keyof typeof TicketTier]

export const TicketTransferStatus = {
  INITIATED: 'initiated',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const
export type TicketTransferStatus = (typeof TicketTransferStatus)[keyof typeof TicketTransferStatus]

export const RefundStatus = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  DENIED: 'denied',
} as const
export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus]

export const ScanResult = {
  VALID: 'valid',
  ALREADY_SCANNED: 'already_scanned',
  INVALID: 'invalid',
  EXPIRED: 'expired',
  TRANSFERRED: 'transferred',
  FRAUDULENT: 'fraudulent',
} as const
export type ScanResult = (typeof ScanResult)[keyof typeof ScanResult]

export const PromoCodeType = {
  PERCENTAGE: 'percentage',
  FIXED_AMOUNT: 'fixed_amount',
  FREE_TICKET: 'free_ticket',
} as const
export type PromoCodeType = (typeof PromoCodeType)[keyof typeof PromoCodeType]

// ── Settlement ──────────────────────────────────────────────────────────────

export const SettlementStatus = {
  PENDING: 'pending',
  CALCULATING: 'calculating',
  READY: 'ready',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DISPUTED: 'disputed',
} as const
export type SettlementStatus = (typeof SettlementStatus)[keyof typeof SettlementStatus]

export const ChargebackStatus = {
  RECEIVED: 'received',
  UNDER_REVIEW: 'under_review',
  EVIDENCE_SUBMITTED: 'evidence_submitted',
  WON: 'won',
  LOST: 'lost',
} as const
export type ChargebackStatus = (typeof ChargebackStatus)[keyof typeof ChargebackStatus]

// ── Media Pipeline ──────────────────────────────────────────────────────────

export const TranscodeJobStatus = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const
export type TranscodeJobStatus = (typeof TranscodeJobStatus)[keyof typeof TranscodeJobStatus]

export const MediaValidationResult = {
  VALID: 'valid',
  INVALID_FORMAT: 'invalid_format',
  CORRUPT_FILE: 'corrupt_file',
  EXCEEDS_SIZE_LIMIT: 'exceeds_size_limit',
  DURATION_TOO_SHORT: 'duration_too_short',
  DURATION_TOO_LONG: 'duration_too_long',
  SILENT_AUDIO: 'silent_audio',
} as const
export type MediaValidationResult = (typeof MediaValidationResult)[keyof typeof MediaValidationResult]

// ── Recommendation / AI ─────────────────────────────────────────────────────

export const RecommendationType = {
  SIMILAR_TRACKS: 'similar_tracks',
  MOOD_BASED: 'mood_based',
  REGIONAL_DISCOVERY: 'regional_discovery',
  ARTIST_AFFINITY: 'artist_affinity',
  SESSION_CONTINUATION: 'session_continuation',
  TRENDING: 'trending',
  NEW_RELEASES: 'new_releases',
  EDITORIAL_PICK: 'editorial_pick',
} as const
export type RecommendationType = (typeof RecommendationType)[keyof typeof RecommendationType]

export const FraudSignalType = {
  STREAM_SPIKE: 'stream_spike',
  BOT_PATTERN: 'bot_pattern',
  REPEATED_SHORT_PLAYS: 'repeated_short_plays',
  GEO_ANOMALY: 'geo_anomaly',
  MASS_UPLOAD: 'mass_upload',
  PAYOUT_ANOMALY: 'payout_anomaly',
  METADATA_POISONING: 'metadata_poisoning',
  ACCOUNT_TAKEOVER: 'account_takeover',
  DUPLICATE_CONTENT: 'duplicate_content',
} as const
export type FraudSignalType = (typeof FraudSignalType)[keyof typeof FraudSignalType]

// ── Mood / Discovery Tags ──────────────────────────────────────────────────

export const MoodTag = {
  ENERGETIC: 'energetic',
  CHILL: 'chill',
  ROMANTIC: 'romantic',
  MELANCHOLIC: 'melancholic',
  UPLIFTING: 'uplifting',
  AGGRESSIVE: 'aggressive',
  SPIRITUAL: 'spiritual',
  PARTY: 'party',
  FOCUS: 'focus',
  WORKOUT: 'workout',
  CELEBRATION: 'celebration',
  NOSTALGIC: 'nostalgic',
} as const
export type MoodTag = (typeof MoodTag)[keyof typeof MoodTag]

export const RegionTag = {
  WEST_AFRICA: 'west_africa',
  EAST_AFRICA: 'east_africa',
  CENTRAL_AFRICA: 'central_africa',
  SOUTHERN_AFRICA: 'southern_africa',
  NORTH_AFRICA: 'north_africa',
  DIASPORA_UK: 'diaspora_uk',
  DIASPORA_US: 'diaspora_us',
  DIASPORA_CANADA: 'diaspora_canada',
  DIASPORA_FRANCE: 'diaspora_france',
  GLOBAL: 'global',
} as const
export type RegionTag = (typeof RegionTag)[keyof typeof RegionTag]

// ── Creator Verification ────────────────────────────────────────────────────

export const VerificationStatus = {
  NOT_SUBMITTED: 'not_submitted',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
} as const
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus]

export const VerificationType = {
  IDENTITY: 'identity',
  LABEL_AFFILIATION: 'label_affiliation',
  RIGHTS_HOLDER: 'rights_holder',
  PROMOTER: 'promoter',
} as const
export type VerificationType = (typeof VerificationType)[keyof typeof VerificationType]

// ── Consent / Privacy ───────────────────────────────────────────────────────

export const ConsentType = {
  DATA_PROCESSING: 'data_processing',
  MARKETING: 'marketing',
  ANALYTICS_TRACKING: 'analytics_tracking',
  RIGHTS_AGREEMENT: 'rights_agreement',
  PAYOUT_TERMS: 'payout_terms',
} as const
export type ConsentType = (typeof ConsentType)[keyof typeof ConsentType]

// ── Export Job ───────────────────────────────────────────────────────────────

export const ExportJobStatus = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
} as const
export type ExportJobStatus = (typeof ExportJobStatus)[keyof typeof ExportJobStatus]

export const ExportFormat = {
  CSV: 'csv',
  JSON: 'json',
  PDF: 'pdf',
  XLSX: 'xlsx',
} as const
export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat]
