import { z } from 'zod';

/**
 * What an organization administrator may write into `organizations.settings`.
 *
 * That JSON is read as authority elsewhere: the per-capita calculator reads `perCapitaRate` and `remittanceDay`, the
 * entitlement service reads `credits` and `nextCreditRenewal`, and `twilioPhoneNumber` attributes inbound texts. None
 * of those is an organization preference, so none is writable here; they change only through their own governed
 * paths. Everything an administrator may set is named below with the type and bound of its value, and an unknown key is
 * refused rather than merged.
 */
const text = (max: number) => z.string().trim().max(max);
const flag = z.boolean();
const slug = z.string().trim().max(40).regex(/^[A-Za-z0-9_-]*$/);
const hostname = z.string().trim().max(253).regex(/^([A-Za-z0-9-]+\.)*[A-Za-z0-9-]*$/);
const httpsUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (value === '') return true;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'must be an https URL');
const stringList = z.union([z.string().trim().max(4000), z.array(z.string().trim().max(253)).max(100)]);

const ADMIN_WRITABLE = {
  timezone: text(64),
  language: text(16),
  defaultLanguage: text(16),
  dateFormat: text(32),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  fiscalYearStart: text(16),
  primaryColor: z.string().trim().regex(/^(#[0-9A-Fa-f]{6})?$/),
  logoUrl: httpsUrl,
  showBranding: flag,
  customDomain: hostname,
  autoApproval: flag,
  requireEmailVerification: flag,
  allowSelfRegistration: flag,
  // A stored label for the member-onboarding screen; no authorization code reads it, and it names no platform role.
  defaultRole: z.enum(['member', 'steward', 'union_admin']),
  memberIdPrefix: z.string().trim().max(12).regex(/^[A-Za-z0-9-]*$/),
  emailProvider: slug,
  smsProvider: slug,
  storageProvider: slug,
  calendarSync: flag,
  sendAdminDigest: flag,
  emailDigest: flag,
  digestFrequency: slug,
  alertThreshold: z.coerce.number().min(0).max(1000),
  enableSystemAlerts: flag,
  enforceStrongPasswords: flag,
  requireMFA: flag,
  mfaEnforcement: flag,
  sessionTimeout: z.coerce.number().int().min(5).max(1440),
  passwordMinLength: z.coerce.number().int().min(8).max(128),
  requireMixedCase: flag,
  requireSymbol: flag,
  rateLimitPerMin: z.coerce.number().int().min(1).max(10000),
  allowedDomains: stringList,
  ipWhitelist: stringList,
  billingCycle: z.enum(['monthly', 'quarterly', 'annual', 'yearly']),
  pushNotifications: flag,
  smsAlerts: flag,
  webhookNotifications: flag,
  webhookUrl: httpsUrl,
  voiceGrievance: flag,
  aiClauseAnalysis: flag,
  mobileAccess: flag,
  crossUnionAnalytics: flag,
} as const;

/** Keys other code reads as authority. Named so the refusal is explicit and an edit to the list above fails a test. */
export const PROTECTED_SETTINGS_KEYS = [
  'perCapitaRate',
  'remittanceDay',
  'credits',
  'nextCreditRenewal',
  'twilioPhoneNumber',
] as const;

export const ADMIN_WRITABLE_SETTINGS_KEYS = Object.keys(ADMIN_WRITABLE) as (keyof typeof ADMIN_WRITABLE)[];

export type OrganizationSettingsValidation =
  | { ok: true; settings: Record<string, unknown> }
  | { ok: false; rejectedKeys: string[]; invalidKeys: string[] };

/** Never echoes a value: the caller reports key names only. */
export function validateOrganizationSettingsPatch(input: unknown): OrganizationSettingsValidation {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, rejectedKeys: [], invalidKeys: ['settings'] };
  }
  const rejectedKeys: string[] = [];
  const invalidKeys: string[] = [];
  const settings: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const schema = Object.prototype.hasOwnProperty.call(ADMIN_WRITABLE, key)
      ? ADMIN_WRITABLE[key as keyof typeof ADMIN_WRITABLE]
      : undefined;
    if (!schema) {
      rejectedKeys.push(key);
      continue;
    }
    // A null or missing value leaves the stored preference as it is; it never writes a value.
    if (value === null || value === undefined) continue;
    const parsed = schema.safeParse(value);
    if (parsed.success) settings[key] = parsed.data;
    else invalidKeys.push(key);
  }
  if (rejectedKeys.length > 0 || invalidKeys.length > 0) return { ok: false, rejectedKeys, invalidKeys };
  return { ok: true, settings };
}
