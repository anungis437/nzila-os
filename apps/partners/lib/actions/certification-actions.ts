/**
 * Partners Server Actions — Certifications.
 *
 * Certification tracks, progress, and completions.
 */
'use server'

import { auth } from '@clerk/nextjs/server'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { revalidatePath } from 'next/cache'
import { buildPartnerEvidencePack } from '@/lib/evidence'

/* ─── Types ─── */

export interface CertTrack {
  id: string
  name: string
  description: string
  modules: number
  completedModules: number
  status: 'not-started' | 'in-progress' | 'completed'
  completedAt: string | null
}

export interface CertProgress {
  tracks: CertTrack[]
  totalCompleted: number
  totalTracks: number
}

/* ─── Certification Definitions ─── */

const CERT_TRACKS: Omit<CertTrack, 'completedModules' | 'status' | 'completedAt'>[] = [
  {
    id: 'fundamentals',
    name: 'Nzila Fundamentals',
    description: 'Core platform knowledge — architecture, APIs, and partner workflows.',
    modules: 5,
  },
  {
    id: 'sales-essentials',
    name: 'Sales Essentials',
    description: 'Lead-to-deal lifecycle, pricing models, and competitive positioning.',
    modules: 4,
  },
  {
    id: 'vertical-specialist',
    name: 'Vertical Specialist',
    description: 'Deep-dive into one industry vertical: healthcare, finance, or education.',
    modules: 6,
  },
  {
    id: 'advanced-architecture',
    name: 'Advanced Architecture',
    description: 'Multi-org design, API integration patterns, and security compliance.',
    modules: 8,
  },
  {
    id: 'co-sell-mastery',
    name: 'Co-Sell Mastery',
    description: 'Joint go-to-market strategy, co-sell playbooks, and partner-led opportunities.',
    modules: 5,
  },
  {
    id: 'partner-leadership',
    name: 'Partner Leadership',
    description: 'Strategic account planning, executive alignment, and ecosystem building.',
    modules: 4,
  },
]

/* ─── Queries ─── */

export async function getCertProgress(): Promise<CertProgress> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  try {
    // Fetch completion records
    const completions = (await platformDb.execute(
      sql`SELECT
        metadata->>'trackId' as "trackId",
        metadata->>'completedModules' as "completedModules",
        metadata->>'status' as status,
        metadata->>'completedAt' as "completedAt"
      FROM audit_log
      WHERE action = 'cert.progress' AND actor_id = ${userId}
      ORDER BY created_at DESC`,
    )) as unknown as {
      rows: Array<{ trackId: string; completedModules: string; status: string; completedAt: string | null }>
    }

    const progressMap = new Map<string, { completedModules: number; status: string; completedAt: string | null }>()
    for (const row of completions.rows ?? []) {
      if (!progressMap.has(row.trackId)) {
        progressMap.set(row.trackId, {
          completedModules: Number(row.completedModules ?? 0),
          status: row.status ?? 'not-started',
          completedAt: row.completedAt,
        })
      }
    }

    const tracks: CertTrack[] = CERT_TRACKS.map((t) => {
      const progress = progressMap.get(t.id)
      return {
        ...t,
        completedModules: progress?.completedModules ?? 0,
        status: (progress?.status as CertTrack['status']) ?? 'not-started',
        completedAt: progress?.completedAt ?? null,
      }
    })

    const totalCompleted = tracks.filter((t) => t.status === 'completed').length

    return { tracks, totalCompleted, totalTracks: CERT_TRACKS.length }
  } catch (error) {
    logger.error('getCertProgress failed', { error })
    return {
      tracks: CERT_TRACKS.map((t) => ({
        ...t,
        completedModules: 0,
        status: 'not-started' as const,
        completedAt: null,
      })),
      totalCompleted: 0,
      totalTracks: CERT_TRACKS.length,
    }
  }
}

/* ─── Mutations ─── */

export async function completeModule(
  trackId: string,
  moduleIndex: number,
): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const track = CERT_TRACKS.find((t) => t.id === trackId)
  if (!track) return { success: false }

  try {
    const completedModules = Math.min(moduleIndex + 1, track.modules)
    const isCompleted = completedModules >= track.modules
    const status = isCompleted ? 'completed' : 'in-progress'

    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
      VALUES ('cert.progress', ${userId}, 'certification', ${trackId},
        ${JSON.stringify({
          trackId,
          completedModules,
          status,
          completedAt: isCompleted ? new Date().toISOString() : null,
          moduleIndex,
        })}::jsonb)`,
    )

    if (isCompleted) {
      await buildPartnerEvidencePack({
        actionId: crypto.randomUUID(),
        actionType: 'CERTIFICATION_COMPLETED',
        orgId: trackId,
        executedBy: userId,
      })
    }

    logger.info('Cert module completed', { trackId, moduleIndex, completedModules, actorId: userId })
    revalidatePath('/portal/certifications')
    return { success: true }
  } catch (error) {
    logger.error('completeModule failed', { error })
    return { success: false }
  }
}
