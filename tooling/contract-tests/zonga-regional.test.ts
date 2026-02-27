/**
 * Contract Test — Zonga Regional (African Market) Features
 *
 * Structural invariants for P0 regional features:
 *   1. zonga-core enums include African currencies, genres, languages, payout rails
 *   2. zonga-core types include regional fields (language, region, payoutRail, collaborators)
 *   3. zonga-core schemas validate new regional fields
 *   4. App locales include African languages
 *   5. Blob upload module wires @nzila/blob for audio
 *   6. Stripe module supports multi-currency and mobile money
 *   7. Upload actions use blob storage and evidence pipeline
 *   8. Pages use multi-currency formatting (no hardcoded CAD)
 *   9. Zonga-services barrel re-exports all regional types
 *
 * @invariant ZNG-REG-01: African currency enum coverage
 * @invariant ZNG-REG-02: African genre taxonomy coverage
 * @invariant ZNG-REG-03: Payout rail enum (mobile money)
 * @invariant ZNG-REG-04: Language enum for African languages
 * @invariant ZNG-REG-05: Creator type has regional fields
 * @invariant ZNG-REG-06: ContentAsset type has language & collaborators
 * @invariant ZNG-REG-07: Schema validates regional inputs
 * @invariant ZNG-REG-08: App locales include African languages
 * @invariant ZNG-REG-09: Blob upload module exists and wires @nzila/blob
 * @invariant ZNG-REG-10: Stripe module supports multi-currency
 * @invariant ZNG-REG-11: Upload actions exist with auth + evidence
 * @invariant ZNG-REG-12: Pages use formatCurrencyAmount, not formatCAD
 * @invariant ZNG-REG-13: Zonga-services barrel exports regional enums
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const ZONGA_CORE = join(ROOT, 'packages', 'zonga-core', 'src')
const ZONGA_APP = join(ROOT, 'apps', 'zonga')
const ZONGA_LIB = join(ZONGA_APP, 'lib')
const ZONGA_PAGES = join(ZONGA_APP, 'app', '[locale]', 'dashboard')

// ── Helpers ─────────────────────────────────────────────────────────────────

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

// ── ZNG-REG-01: African Currency Enum ───────────────────────────────────────

describe('ZNG-REG-01 — African currency enum coverage', () => {
  const enums = readSafe(join(ZONGA_CORE, 'enums.ts'))

  const EXPECTED_CURRENCIES = [
    'NGN', 'KES', 'ZAR', 'XOF', 'XAF', 'GHS',
    'TZS', 'UGX', 'ETB', 'RWF', 'CDF', 'EGP', 'MAD',
    'USD', 'CAD', 'EUR', 'GBP',
  ]

  it('exports ZongaCurrency const', () => {
    expect(enums).toContain('export const ZongaCurrency')
  })

  for (const code of EXPECTED_CURRENCIES) {
    it(`ZongaCurrency includes ${code}`, () => {
      expect(enums).toContain(`${code}: '${code}'`)
    })
  }
})

// ── ZNG-REG-02: African Genre Taxonomy ──────────────────────────────────────

describe('ZNG-REG-02 — African genre taxonomy coverage', () => {
  const enums = readSafe(join(ZONGA_CORE, 'enums.ts'))

  const SIGNATURE_GENRES = [
    'afrobeats', 'amapiano', 'bongo_flava', 'highlife',
    'soukous', 'gengetone', 'kizomba', 'gqom',
    'makossa', 'mbalax', 'ndombolo', 'taarab',
    'fuji', 'juju', 'rai', 'kuduro',
  ]

  it('exports AfricanGenre const', () => {
    expect(enums).toContain('export const AfricanGenre')
  })

  for (const genre of SIGNATURE_GENRES) {
    it(`AfricanGenre includes ${genre}`, () => {
      expect(enums).toContain(`'${genre}'`)
    })
  }

  it('AfricanGenre has at least 50 entries', () => {
    const matches = enums.match(/AfricanGenre[\s\S]*?} as const/)?.[0]
    const entries = matches?.match(/: '/g)?.length ?? 0
    expect(entries).toBeGreaterThanOrEqual(50)
  })
})

// ── ZNG-REG-03: Payout Rail Enum ────────────────────────────────────────────

describe('ZNG-REG-03 — Payout rail enum (mobile money)', () => {
  const enums = readSafe(join(ZONGA_CORE, 'enums.ts'))

  const EXPECTED_RAILS = [
    'stripe_connect', 'mpesa', 'mtn_momo',
    'airtel_money', 'orange_money', 'bank_transfer',
    'flutterwave',
  ]

  it('exports PayoutRail const', () => {
    expect(enums).toContain('export const PayoutRail')
  })

  for (const rail of EXPECTED_RAILS) {
    it(`PayoutRail includes ${rail}`, () => {
      expect(enums).toContain(`'${rail}'`)
    })
  }
})

// ── ZNG-REG-04: Language Enum ───────────────────────────────────────────────

describe('ZNG-REG-04 — Language enum for African languages', () => {
  const enums = readSafe(join(ZONGA_CORE, 'enums.ts'))

  const EXPECTED_LANGUAGES = [
    'en', 'fr', 'pt', 'ar', 'sw', 'yo', 'ha', 'am', 'ig', 'zu',
  ]

  it('exports ZongaLanguage const', () => {
    expect(enums).toContain('export const ZongaLanguage')
  })

  for (const lang of EXPECTED_LANGUAGES) {
    it(`ZongaLanguage includes ${lang}`, () => {
      expect(enums).toContain(`'${lang}'`)
    })
  }
})

// ── ZNG-REG-05: Creator Type Regional Fields ────────────────────────────────

describe('ZNG-REG-05 — Creator type has regional fields', () => {
  const types = readSafe(join(ZONGA_CORE, 'types', 'index.ts'))

  it('Creator has language field', () => {
    expect(types).toContain('language: ZongaLanguage | null')
  })

  it('Creator has region field', () => {
    expect(types).toContain('region: CreatorRegion | null')
  })

  it('Creator has payoutRail field', () => {
    expect(types).toContain('payoutRail: PayoutRail | null')
  })

  it('Creator has payoutAccountRef field', () => {
    expect(types).toContain('payoutAccountRef: string | null')
  })

  it('Creator has payoutCurrency field', () => {
    expect(types).toContain('payoutCurrency: ZongaCurrency | null')
  })

  it('exports CreatorRegion type', () => {
    expect(types).toContain('CreatorRegion')
  })
})

// ── ZNG-REG-06: ContentAsset Type Regional Fields ───────────────────────────

describe('ZNG-REG-06 — ContentAsset type has language & collaborators', () => {
  const types = readSafe(join(ZONGA_CORE, 'types', 'index.ts'))

  it('ContentAsset has language field', () => {
    expect(types).toContain('language: ZongaLanguage | null')
  })

  it('ContentAsset has collaborators field', () => {
    expect(types).toContain('collaborators: readonly string[]')
  })

  it('ContentAsset has isrc field', () => {
    expect(types).toContain('isrc: string | null')
  })

  it('ContentAsset has audioFingerprint field', () => {
    expect(types).toContain('audioFingerprint: string | null')
  })

  it('ContentAsset has qualityTiers field', () => {
    expect(types).toContain('qualityTiers: readonly AudioQuality[]')
  })
})

// ── ZNG-REG-07: Schema Validates Regional Inputs ────────────────────────────

describe('ZNG-REG-07 — Schemas validate regional inputs', () => {
  const schemas = readSafe(join(ZONGA_CORE, 'schemas', 'index.ts'))

  it('CreateCreatorSchema has language field', () => {
    expect(schemas).toContain('language:')
  })

  it('CreateCreatorSchema has region field', () => {
    expect(schemas).toContain('region:')
  })

  it('CreateCreatorSchema has payoutRail field', () => {
    expect(schemas).toContain('payoutRail:')
  })

  it('CreateContentAssetSchema has language field', () => {
    expect(schemas).toContain('language:')
  })

  it('CreateContentAssetSchema has collaborators field', () => {
    expect(schemas).toContain('collaborators:')
  })

  it('RecordRevenueEventSchema uses ZongaCurrency enum', () => {
    expect(schemas).toContain('ZongaCurrency')
  })

  it('exports AudioUploadMetaSchema', () => {
    expect(schemas).toContain('export const AudioUploadMetaSchema')
  })

  it('exports RoyaltySplitSchema', () => {
    expect(schemas).toContain('export const RoyaltySplitSchema')
  })

  it('AudioUploadMetaSchema validates contentType for audio formats', () => {
    expect(schemas).toContain("'audio/mpeg'")
    expect(schemas).toContain("'audio/flac'")
    expect(schemas).toContain("'audio/wav'")
  })

  it('AudioUploadMetaSchema has 500MB file size limit', () => {
    expect(schemas).toContain('500_000_000')
  })
})

// ── ZNG-REG-08: App Locales Include African Languages ───────────────────────

describe('ZNG-REG-08 — App locales include African languages', () => {
  const locales = readSafe(join(ZONGA_LIB, 'locales.ts'))

  const AFRICAN_LOCALES = ['sw', 'yo', 'ha', 'am', 'ig', 'zu', 'ln', 'wo']

  for (const locale of AFRICAN_LOCALES) {
    it(`locales array includes '${locale}'`, () => {
      expect(locales).toContain(`'${locale}'`)
    })
  }

  it('exports localeLabels record', () => {
    expect(locales).toContain('export const localeLabels')
  })

  it('exports getDir function for RTL support', () => {
    expect(locales).toContain('export function getDir')
  })

  it('defaultLocale is "en"', () => {
    expect(locales).toContain("defaultLocale: Locale = 'en'")
  })
})

// ── ZNG-REG-09: Blob Upload Module ──────────────────────────────────────────

describe('ZNG-REG-09 — Blob upload module exists and wires @nzila/blob', () => {
  const blobPath = join(ZONGA_LIB, 'blob.ts')

  it('blob.ts exists', () => {
    expect(existsSync(blobPath)).toBe(true)
  })

  const blob = readSafe(blobPath)

  it('imports from @nzila/blob', () => {
    expect(blob).toContain('@nzila/blob')
  })

  it('exports uploadAudioFile function', () => {
    expect(blob).toContain('export async function uploadAudioFile')
  })

  it('exports uploadCoverArt function', () => {
    expect(blob).toContain('export async function uploadCoverArt')
  })

  it('exports getAudioStreamUrl function', () => {
    expect(blob).toContain('export async function getAudioStreamUrl')
  })

  it('exports getCoverArtUrl function', () => {
    expect(blob).toContain('export async function getCoverArtUrl')
  })

  it('exports fingerprintAudio function', () => {
    expect(blob).toContain('export async function fingerprintAudio')
  })

  it('uses computeSha256 from @nzila/blob', () => {
    expect(blob).toContain('computeSha256')
  })

  it('uses generateSasUrl from @nzila/blob', () => {
    expect(blob).toContain('generateSasUrl')
  })

  it('defines AUDIO_CONTAINER constant', () => {
    expect(blob).toContain("AUDIO_CONTAINER = 'zonga-audio'")
  })

  it('defines COVER_CONTAINER constant', () => {
    expect(blob).toContain("COVER_CONTAINER = 'zonga-covers'")
  })

  it('validates audio MIME types', () => {
    expect(blob).toContain("'audio/mpeg'")
    expect(blob).toContain("'audio/wav'")
    expect(blob).toContain("'audio/flac'")
  })

  it('enforces file size limits', () => {
    expect(blob).toContain('MAX_AUDIO_SIZE_BYTES')
    expect(blob).toContain('MAX_COVER_SIZE_BYTES')
  })
})

// ── ZNG-REG-10: Stripe Multi-Currency ───────────────────────────────────────

describe('ZNG-REG-10 — Stripe module supports multi-currency', () => {
  const stripe = readSafe(join(ZONGA_LIB, 'stripe.ts'))

  it('imports ZongaCurrency type', () => {
    expect(stripe).toContain('ZongaCurrency')
  })

  it('imports PayoutRail type', () => {
    expect(stripe).toContain('PayoutRail')
  })

  it('exports STRIPE_SUPPORTED_CURRENCIES set', () => {
    expect(stripe).toContain('STRIPE_SUPPORTED_CURRENCIES')
  })

  it('STRIPE_SUPPORTED_CURRENCIES includes ngn, kes, zar', () => {
    expect(stripe).toContain("'ngn'")
    expect(stripe).toContain("'kes'")
    expect(stripe).toContain("'zar'")
  })

  it('exports CURRENCY_FALLBACK mapping', () => {
    expect(stripe).toContain('CURRENCY_FALLBACK')
  })

  it('executeCreatorPayout accepts payoutRail parameter', () => {
    expect(stripe).toContain('payoutRail?:')
  })

  it('executeCreatorPayout returns settledCurrency', () => {
    expect(stripe).toContain('settledCurrency')
  })

  it('exports executeMobileMoneyPayout placeholder', () => {
    expect(stripe).toContain('export async function executeMobileMoneyPayout')
  })

  it('exports formatCurrencyAmount function', () => {
    expect(stripe).toContain('export function formatCurrencyAmount')
  })

  it('formatCurrencyAmount handles zero-decimal currencies', () => {
    expect(stripe).toContain('zeroDecimal')
  })

  it('executeCreatorPayout supports idempotencyKey', () => {
    expect(stripe).toContain('idempotencyKey')
  })

  it('no longer defaults to CAD currency', () => {
    // The default should be 'usd' not 'cad'
    expect(stripe).not.toContain("?? 'cad'")
  })
})

// ── ZNG-REG-11: Upload Actions ──────────────────────────────────────────────

describe('ZNG-REG-11 — Upload actions exist with auth + evidence', () => {
  const uploadPath = join(ZONGA_LIB, 'actions', 'upload-actions.ts')

  it('upload-actions.ts exists', () => {
    expect(existsSync(uploadPath)).toBe(true)
  })

  const upload = readSafe(uploadPath)

  it("has 'use server' directive", () => {
    expect(upload).toContain("'use server'")
  })

  it('calls auth() for authentication', () => {
    // resolveOrgContext() wraps auth() — see lib/resolve-org.ts
    expect(
      upload.includes('auth()') || upload.includes('resolveOrgContext()'),
      'upload-actions must call auth() directly or via resolveOrgContext()',
    ).toBe(true)
  })

  it('exports uploadAudio function', () => {
    expect(upload).toContain('export async function uploadAudio')
  })

  it('exports uploadCover function', () => {
    expect(upload).toContain('export async function uploadCover')
  })

  it('exports getStreamUrl function', () => {
    expect(upload).toContain('export async function getStreamUrl')
  })

  it('uses AudioUploadMetaSchema for validation', () => {
    expect(upload).toContain('AudioUploadMetaSchema')
  })

  it('integrates evidence pipeline', () => {
    expect(upload).toContain('buildEvidencePackFromAction')
    expect(upload).toContain('processEvidencePack')
  })

  it('generates audit events via buildZongaAuditEvent', () => {
    expect(upload).toContain('buildZongaAuditEvent')
  })

  it('uses ZongaAuditAction.CONTENT_UPLOAD', () => {
    expect(upload).toContain('CONTENT_UPLOAD')
  })

  it('uses blob storage for file upload', () => {
    expect(upload).toContain('uploadAudioFile')
  })

  it('computes audio fingerprint', () => {
    expect(upload).toContain('fingerprintAudio')
  })
})

// ── ZNG-REG-12: Pages Use Multi-Currency Formatting ─────────────────────────

describe('ZNG-REG-12 — Pages use multi-currency formatting, not formatCAD', () => {
  const PAGES_WITH_CURRENCY = [
    'revenue/page.tsx',
    'payouts/page.tsx',
    'analytics/page.tsx',
  ]

  for (const page of PAGES_WITH_CURRENCY) {
    const content = readSafe(join(ZONGA_PAGES, page))

    it(`${page} imports formatCurrencyAmount from stripe`, () => {
      expect(content).toContain('formatCurrencyAmount')
    })

    it(`${page} does not contain formatCAD function`, () => {
      expect(content).not.toContain('function formatCAD')
    })
  }
})

// ── ZNG-REG-13: Zonga-Services Barrel Exports ───────────────────────────────

describe('ZNG-REG-13 — Zonga-services barrel exports regional enums', () => {
  const barrel = readSafe(join(ZONGA_LIB, 'zonga-services.ts'))

  const REGIONAL_EXPORTS = [
    'PayoutRail',
    'ZongaCurrency',
    'AfricanGenre',
    'AudioQuality',
    'ZongaLanguage',
    'AfricanCountry',
    'AudioUploadMetaSchema',
    'RoyaltySplitSchema',
    'CreatorRegion',
    'RoyaltySplit',
    'AudioUploadResult',
  ]

  for (const symbol of REGIONAL_EXPORTS) {
    it(`barrel exports ${symbol}`, () => {
      expect(barrel).toContain(symbol)
    })
  }
})

// ── ZNG-REG-14: Catalog Page Genre Filter ───────────────────────────────────

describe('ZNG-REG-14 — Catalog page has African genre filter', () => {
  const catalog = readSafe(join(ZONGA_PAGES, 'catalog', 'page.tsx'))

  it('imports AfricanGenre from zonga-services', () => {
    expect(catalog).toContain('AfricanGenre')
  })

  it('defines GENRE_GROUPS filter array', () => {
    expect(catalog).toContain('GENRE_GROUPS')
  })

  it('accepts genre search param', () => {
    expect(catalog).toContain('genre?:')
  })

  it('shows collaborators in asset cards', () => {
    expect(catalog).toContain('collaborators')
  })

  it('shows language badge on asset cards', () => {
    expect(catalog).toContain('asset.language')
  })
})

// ── ZNG-REG-15: Creators Page Regional Display ─────────────────────────────

describe('ZNG-REG-15 — Creators page shows regional information', () => {
  const creators = readSafe(join(ZONGA_PAGES, 'creators', 'page.tsx'))

  it('imports formatCurrencyAmount from stripe', () => {
    expect(creators).toContain('formatCurrencyAmount')
  })

  it('defines railLabels for payout rail display', () => {
    expect(creators).toContain('railLabels')
  })

  it('shows region emoji for creators', () => {
    expect(creators).toContain('regionEmoji')
  })

  it('shows payout rail badge', () => {
    expect(creators).toContain('payoutRail')
  })

  it('shows payout currency', () => {
    expect(creators).toContain('payoutCurrency')
  })
})

// ── ZNG-REG-16: Payouts Page Payout Rail Column ─────────────────────────────

describe('ZNG-REG-16 — Payouts page shows payout rail column', () => {
  const payouts = readSafe(join(ZONGA_PAGES, 'payouts', 'page.tsx'))

  it('has Rail table header', () => {
    expect(payouts).toContain('>Rail<')
  })

  it('shows railLabels in table rows', () => {
    expect(payouts).toContain('railLabels')
  })

  it('uses formatCurrencyAmount for amounts', () => {
    expect(payouts).toContain('formatCurrencyAmount')
  })

  it('does not contain formatCAD function', () => {
    expect(payouts).not.toContain('function formatCAD')
  })
})

// ── ZNG-REG-17: Audit Actions for Regional Operations ──────────────────────

describe('ZNG-REG-17 — Audit service includes regional actions', () => {
  const audit = readSafe(join(ZONGA_CORE, 'services', 'audit.ts'))

  it('CONTENT_UPLOAD audit action exists', () => {
    expect(audit).toContain("CONTENT_UPLOAD: 'content.upload'")
  })

  it('CREATOR_UPDATE_PAYOUT audit action exists', () => {
    expect(audit).toContain("CREATOR_UPDATE_PAYOUT: 'creator.update_payout'")
  })

  it('RELEASE_SPLIT_UPDATE audit action exists', () => {
    expect(audit).toContain("RELEASE_SPLIT_UPDATE: 'release.split_update'")
  })
})

// ── ZNG-REG-18: AudioQuality Enum ───────────────────────────────────────────

describe('ZNG-REG-18 — AudioQuality enum for bandwidth-sensitive markets', () => {
  const enums = readSafe(join(ZONGA_CORE, 'enums.ts'))

  it('exports AudioQuality const', () => {
    expect(enums).toContain('export const AudioQuality')
  })

  const TIERS = ['low', 'medium', 'high', 'lossless']

  for (const tier of TIERS) {
    it(`AudioQuality includes ${tier}`, () => {
      expect(enums).toContain(`'${tier}'`)
    })
  }
})

// ── ZNG-REG-19: African Country Codes ───────────────────────────────────────

describe('ZNG-REG-19 — African country codes enum', () => {
  const enums = readSafe(join(ZONGA_CORE, 'enums.ts'))

  it('exports AfricanCountry const', () => {
    expect(enums).toContain('export const AfricanCountry')
  })

  const KEY_COUNTRIES = ['NG', 'KE', 'ZA', 'GH', 'TZ', 'ET', 'CM', 'CD', 'EG', 'MA']

  for (const code of KEY_COUNTRIES) {
    it(`AfricanCountry includes ${code}`, () => {
      expect(enums).toContain(`${code}: '${code}'`)
    })
  }
})

// ── ZNG-REG-20: Types Import New Enums ──────────────────────────────────────

describe('ZNG-REG-20 — Types file imports all new enum types', () => {
  const types = readSafe(join(ZONGA_CORE, 'types', 'index.ts'))

  const NEW_IMPORTS = [
    'PayoutRail',
    'ZongaCurrency',
    'ZongaLanguage',
    'AfricanGenre',
    'AudioQuality',
  ]

  for (const imp of NEW_IMPORTS) {
    it(`types imports ${imp}`, () => {
      expect(types).toContain(imp)
    })
  }

  it('exports RoyaltySplit interface', () => {
    expect(types).toContain('export interface RoyaltySplit')
  })

  it('exports AudioUploadResult interface', () => {
    expect(types).toContain('export interface AudioUploadResult')
  })

  it('Payout type has payoutRail field', () => {
    expect(types).toContain('payoutRail: PayoutRail | null')
  })
})
