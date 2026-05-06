/**
 * TrustCore — Incident Validation Schema
 * Zod schema for POST /api/incidents request bodies.
 */
import { z } from 'zod'

export const createIncidentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(5000).optional(),
  incidentType: z.enum([
    'unauthorized_access',
    'unauthorized_use',
    'unauthorized_disclosure',
    'loss',
    'other',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  dateDetected: z.string().min(1, 'Detection date is required'),
  harmAssessment: z.string().max(5000).optional(),
  seriousHarmLikely: z.boolean().default(false),
})

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>
