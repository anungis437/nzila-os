/**
 * TrustCore — Onboarding Wizard Validation Schemas
 *
 * Covers all 6 wizard steps. The top-level OnboardingInput is the
 * full payload sent to POST /api/onboarding.
 */
import { z } from 'zod'

// ── Step 1 — Organization Basics ──────────────────────────────────────────

export const step1Schema = z.object({
  orgName: z.string().min(1, 'Organization name is required').max(255),
  industry: z.string().min(1, 'Industry is required').max(100),
  province: z.string().min(1, 'Province/jurisdiction is required').max(100),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
})

export type Step1Input = z.infer<typeof step1Schema>

// ── Step 2 — Privacy Officer ──────────────────────────────────────────────

export const step2Schema = z.object({
  officerName: z.string().min(1, 'Privacy officer name is required').max(255),
  officerEmail: z.string().email('Must be a valid email address'),
  officerTitle: z.string().min(1, 'Role/title is required').max(255),
})

export type Step2Input = z.infer<typeof step2Schema>

// ── Step 3 — Data Profile ─────────────────────────────────────────────────

export const dataTypeEnum = z.enum([
  'contact',
  'financial',
  'health',
  'employee',
  'children',
  'other',
])
export type DataType = z.infer<typeof dataTypeEnum>

export const step3Schema = z.object({
  collectsPersonalData: z.boolean(),
  dataTypes: z.array(dataTypeEnum).default([]),
  storesOutsideCanada: z.boolean().default(false),
})

export type Step3Input = z.infer<typeof step3Schema>

// ── Step 4 — Vendors ──────────────────────────────────────────────────────

export const knownVendorEnum = z.enum([
  'google_workspace',
  'microsoft_365',
  'stripe',
  'shopify',
  'other',
])
export type KnownVendor = z.infer<typeof knownVendorEnum>

export const step4Schema = z.object({
  usesThirdPartyTools: z.boolean(),
  selectedVendors: z.array(knownVendorEnum).default([]),
  /** Free-text other vendors, newline-separated. */
  otherVendors: z.string().max(1000).default(''),
})

export type Step4Input = z.infer<typeof step4Schema>

// ── Step 5 — Consent & Practices ─────────────────────────────────────────

export const step5Schema = z.object({
  collectsConsent: z.boolean(),
  handlesDsrRequests: z.boolean(),
  hasIncidentProcedures: z.boolean(),
})

export type Step5Input = z.infer<typeof step5Schema>

// ── Full payload ──────────────────────────────────────────────────────────

export const onboardingSchema = z.object({
  step1: step1Schema,
  step2: step2Schema,
  step3: step3Schema,
  step4: step4Schema,
  step5: step5Schema,
})

export type OnboardingInput = z.infer<typeof onboardingSchema>
