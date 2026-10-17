import { z } from 'zod'
import { safeJsonValueSchema } from '../../contracts'

const compoundIdentifierSchema = z
  .object({
    referenceId: z.number().int().optional(),
    uniqueIds: z
      .array(
        z
          .object({
            id: z.string().min(1),
            source: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
  })
  .strict()

const numericRepresentationSchema = z
  .object({
    value: z.number().finite(),
    unit: z
      .object({
        code: z.enum(['ha', 'acre']),
      })
      .strict(),
  })
  .strict()

export const adaptSyntheticDocumentSchema = z
  .object({
    standardVersion: z.literal('3.1.0'),
    dataSetId: z.string().min(1),
    sourceOrigin: z
      .object({
        providerId: z.string().min(1).optional(),
        authorityId: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    farm: z
      .object({
        id: compoundIdentifierSchema,
        description: z.string().optional(),
      })
      .strict(),
    field: z
      .object({
        id: compoundIdentifierSchema,
        farmId: z.number().int().optional(),
        area: numericRepresentationSchema.optional(),
      })
      .strict(),
    boundary: z
      .object({
        id: compoundIdentifierSchema,
        fieldId: z.number().int().optional(),
        spatialData: safeJsonValueSchema.optional(),
        originalEpsgCode: z.string().optional(),
      })
      .strict(),
    operation: z
      .object({
        id: compoundIdentifierSchema,
        operationType: z.string().min(1),
        measurement: z
          .object({
            value: z.number().finite(),
            unit: z.string().min(1),
          })
          .strict(),
        timeScope: z
          .object({
            dateContext: z.string().min(1).optional(),
            timeStamp1: z.string().datetime().optional(),
            timeStamp2: z.string().datetime().optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict()

export type AdaptSyntheticDocument = z.infer<typeof adaptSyntheticDocumentSchema>
