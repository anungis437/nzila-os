/**
 * ARTIFACT TYPE: API Route
 * DOCTRINE_VERSION: 1.0.0
 *
 * POST /api/icra/email-results
 *
 * Sends the results URL to a recipient address so the respondent can
 * recover their report later. Privacy-preserving: the recipient email
 * is never stored. Only a one-way SHA-256 hash is logged with the
 * results_emailed event, alongside the assessment id and IP hash.
 *
 * Rate limited: 5 sends per hour per IP.
 *
 * Capability rotation: the results page now requires the assessment
 * capability (see lib/icra/assessment-capability.ts); this route never has
 * the original raw token (only its hash is ever persisted), so recovery
 * ROTATES a fresh capability and embeds the new raw token in the emailed
 * link's URL FRAGMENT (`#cap=...`), never a query parameter — fragments
 * are not sent to the server or logged in access logs/referrers. FRONTEND
 * FOLLOW-UP REQUIRED: the results page must read `location.hash`, extract
 * `cap`, and present it as `Authorization: Bearer <cap>` (or exchange it for
 * the HttpOnly capability cookie) when calling the results/profile/report
 * APIs — this is out of this API-route audit's scope and must be wired up
 * separately before this recovery flow is fully functional end-to-end.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { eq } from 'drizzle-orm'
import { icraAssessments } from '@/db/schema/icra-schema'
import { withSystemContext } from '@/lib/db/with-rls-context'
import {
  generateCapabilityToken,
  hashCapabilityToken,
  computeCapabilityExpiry,
} from '@/lib/icra/assessment-capability'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail, isValidEmail } from '@/lib/email-service'
import { fireAndForgetEvent, hashIp } from '@/lib/icra/observability'
import { logger } from '@/lib/logger'

interface RequestBody {
  assessmentId?: any
  email?: any
  locale?: any
}

const COPY = {
  'en-CA': {
    subject: 'Your Institutional Continuity Risk Assessment results',
    heading: 'Your continuity profile is ready',
    intro:
      'You requested a link to your Institutional Continuity Risk Assessment results. Use the link below to revisit your continuity profile, recommendations, and the full deterministic scoring trace.',
    cta: 'Open my results',
    footnote:
      'This link is the only way to reach your assessment. We did not store your email address — only the fact that a send was requested.',
  },
  'fr-CA': {
    subject: 'Vos résultats — Évaluation du risque de continuité institutionnelle',
    heading: 'Votre profil de continuité est prêt',
    intro:
      "Vous avez demandé un lien vers les résultats de votre évaluation du risque de continuité institutionnelle. Utilisez le lien ci-dessous pour revoir votre profil, les recommandations et la trace de notation complète.",
    cta: 'Ouvrir mes résultats',
    footnote:
      "Ce lien est le seul moyen d'accéder à votre évaluation. Nous n'avons pas conservé votre adresse courriel — seulement le fait qu'un envoi a été demandé.",
  },
} as const

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ipHash = hashIp(ip)

  const rl = rateLimit(req, { maxRequests: 5, windowSeconds: 60 * 60 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many email requests. Please try again later.' },
      { status: 429 },
    )
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const assessmentId = typeof body.assessmentId === 'string' ? body.assessmentId : null
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : null
  const locale =
    body.locale === 'fr-CA' ? 'fr-CA' : ('en-CA' as keyof typeof COPY)

  if (!assessmentId || !email) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
  }

  // Confirm the assessment exists and rotate a fresh capability token for
  // the recovery link. We do NOT require auth: anyone who already holds the
  // assessmentId can request the link — they would have had it from the
  // original submission redirect either way, and rotation invalidates any
  // capability an attacker might have separately obtained.
  const rotated = await withSystemContext(async (tx) => {
    const [assessment] = await tx
      .select({ id: icraAssessments.id })
      .from(icraAssessments)
      .where(eq(icraAssessments.id, assessmentId))
      .limit(1)

    if (!assessment) return null

    const capabilityToken = generateCapabilityToken()
    await tx
      .update(icraAssessments)
      .set({
        capabilityTokenHash: hashCapabilityToken(capabilityToken),
        capabilityTokenExpiresAt: computeCapabilityExpiry(),
      })
      .where(eq(icraAssessments.id, assessmentId))

    return capabilityToken
  })

  if (!rotated) {
    // Avoid leaking existence — return 200 silently.
    return NextResponse.json({ ok: true })
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const resultsUrl = `${baseUrl}/${locale}/continuity-assessment/results/${assessmentId}#cap=${encodeURIComponent(rotated)}`
  const copy = COPY[locale]

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1c1917;">
      <h1 style="font-size:22px;font-weight:600;letter-spacing:-0.01em;margin:0 0 16px;">${copy.heading}</h1>
      <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 24px;">${copy.intro}</p>
      <p style="margin:24px 0;">
        <a href="${resultsUrl}"
           style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;font-weight:500;font-size:14px;padding:12px 24px;border-radius:6px;">
          ${copy.cta}
        </a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#78716c;margin:32px 0 0;">${copy.footnote}</p>
      <p style="font-size:11px;color:#a8a29e;margin:24px 0 0;word-break:break-all;">
        ${resultsUrl}
      </p>
    </div>
  `.trim()

  try {
    const result = await sendEmail({
      to: [{ email, name: '' }],
      subject: copy.subject,
      html,
    })

    const emailHash = createHash('sha256').update(email).digest('hex').slice(0, 32)
    fireAndForgetEvent({
      kind: 'results_emailed',
      assessmentId,
      ipHash,
      metadata: {
        sent: result.success,
        emailHash,
        locale,
      },
    })

    if (!result.success) {
      logger.warn('[icra-email-results] send failed', { assessmentId, error: result.error })
      return NextResponse.json(
        { error: 'Email delivery failed. Please try again.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error(
      '[icra-email-results] send threw',
      error instanceof Error ? error : new Error(String(error)),
    )
    return NextResponse.json({ error: 'Email delivery failed.' }, { status: 500 })
  }
}
