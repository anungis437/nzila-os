import { z } from 'zod'

/**
 * A collective agreement as an officer may create it. The row is stored as typed and read by other features (search, comparison,
 * AI analysis), so every field is typed and bounded and the dates must be consistent. Fields the server owns (organization,
 * publication, authorship) are not part of the input.
 */
export const AGREEMENT_STATUSES = ['active', 'expired', 'under_negotiation', 'ratified_pending', 'archived'] as const
export const AGREEMENT_JURISDICTIONS = [
  'federal', 'ontario', 'bc', 'alberta', 'quebec', 'manitoba', 'saskatchewan', 'nova_scotia', 'new_brunswick', 'pei',
  'newfoundland', 'northwest_territories', 'yukon', 'nunavut',
] as const

const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((value) => value || null)

export const agreementCreateSchema = z
  .object({
    cbaNumber: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(500),
    jurisdiction: z.enum(AGREEMENT_JURISDICTIONS),
    language: z.enum(['en', 'fr', 'bilingual']).default('en'),
    employerName: z.string().trim().min(1).max(300),
    employerId: optionalText(100),
    unionName: z.string().trim().min(1).max(300),
    unionLocal: optionalText(100),
    unionId: optionalText(100),
    effectiveDate: z.coerce.date(),
    expiryDate: z.coerce.date(),
    signedDate: z.coerce.date().nullish().transform((value) => value ?? null),
    ratificationDate: z.coerce.date().nullish().transform((value) => value ?? null),
    industrySector: z.string().trim().min(1).max(200),
    sector: optionalText(200),
    employeeCoverage: z.number().int().min(0).max(10_000_000).nullish().transform((value) => value ?? null),
    bargainingUnitDescription: optionalText(10_000),
    documentUrl: z.string().trim().max(2000).url().refine((value) => /^https:\/\//i.test(value), 'documentUrl must be an https address').nullish().transform((value) => value ?? null),
    status: z.enum(AGREEMENT_STATUSES).default('active'),
  })
  .refine((value) => value.expiryDate.getTime() > value.effectiveDate.getTime(), { message: 'expiryDate must be after effectiveDate', path: ['expiryDate'] })

export type AgreementCreate = z.infer<typeof agreementCreateSchema>