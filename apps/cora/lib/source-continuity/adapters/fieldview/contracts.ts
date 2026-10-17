import { safeJsonValueSchema } from '../../contracts'
import { z } from 'zod'

const sourceOriginSchema = z
  .object({
    providerId: z.string().min(1),
    authorityId: z.string().min(1),
  })
  .strict()

const areaSchema = z
  .object({
    value: z.number().positive(),
    unit: z.literal('acre'),
  })
  .strict()

const measuredRateSchema = z
  .object({
    value: z.number().finite(),
    unit: z.string().min(1),
  })
  .strict()

export const fieldViewSyntheticDocumentSchema = z
  .object({
    standardVersion: z.literal('4.0.11'),
    documentId: z.string().min(1),
    sourceOrigin: sourceOriginSchema.optional(),
    farm: z
      .object({
        guid: z.string().min(1),
        displayName: z.string().min(1),
      })
      .strict(),
    field: z
      .object({
        guid: z.string().min(1),
        farmGuid: z.string().min(1),
        displayName: z.string().min(1),
        area: areaSchema,
      })
      .strict(),
    boundary: z
      .object({
        guid: z.string().min(1),
        fieldGuid: z.string().min(1),
        geometry: safeJsonValueSchema,
      })
      .strict(),
    activity: z
      .object({
        guid: z.string().min(1),
        fieldGuid: z.string().min(1),
        boundaryGuid: z.string().min(1),
        activityType: z.enum(['SEEDING', 'APPLICATION', 'HARVEST']),
        measuredRate: measuredRateSchema,
        effectiveAt: z.string().datetime(),
        observedAt: z.string().datetime(),
        lastModifiedTime: z.string().datetime(),
      })
      .strict(),
  })
  .strict()

export type FieldViewSyntheticDocument = z.infer<typeof fieldViewSyntheticDocumentSchema>
