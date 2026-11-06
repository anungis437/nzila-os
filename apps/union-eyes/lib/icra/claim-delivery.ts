/**
 * Delivery of the ICRA claim credential to the buyer (DEF-0B8-ICRA-CLAIM-TOKEN-HAS-NO-ICRA-ISSUER-SO-CLAIM-CANNOT-SUCCEED).
 *
 * The Stripe webhook issues the single-use claim token on a paid tier upgrade; this sends the buyer the link to the claim page that
 * redeems it. It fails closed: with no buyer e-mail, no public application address (NEXT_PUBLIC_APP_URL, https outside development)
 * or no configured e-mail sender, nothing is sent and the reason is returned, never a success. The token is never logged or returned.
 */
import { sendEmail } from '@/lib/email-service'
import { isAssessmentId } from '@/lib/icra/assessment-id'

export type ClaimDeliveryResult =
  | { delivered: true }
  | { delivered: false; reason: 'NO_BUYER_EMAIL' | 'APP_URL_NOT_CONFIGURED' | 'INVALID_ASSESSMENT' | 'SEND_FAILED' }

const EMAIL_SHAPE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/

/** The configured public base address, or null when it is missing or (outside development) not https. */
export function claimLinkBase(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol === 'https:') return raw
    if (url.protocol === 'http:' && env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname)) return raw
    return null
  } catch {
    return null
  }
}

export function icraClaimLink(base: string, locale: 'en-CA' | 'fr-CA', assessmentId: string, claimToken: string): string {
  const query = new URLSearchParams({ assessmentId, token: claimToken })
  return `${base}/${locale}/continuity-assessment/claim?${query.toString()}`
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export async function deliverIcraClaimCredential(input: {
  assessmentId: string
  claimToken: string
  buyerEmail: string | null | undefined
  locale?: string | null
}): Promise<ClaimDeliveryResult> {
  if (!isAssessmentId(input.assessmentId)) return { delivered: false, reason: 'INVALID_ASSESSMENT' }
  const email = (input.buyerEmail ?? '').trim()
  if (!email || !EMAIL_SHAPE.test(email)) return { delivered: false, reason: 'NO_BUYER_EMAIL' }
  const base = claimLinkBase()
  if (!base) return { delivered: false, reason: 'APP_URL_NOT_CONFIGURED' }

  const fr = (input.locale ?? '').toLowerCase().startsWith('fr')
  const link = icraClaimLink(base, fr ? 'fr-CA' : 'en-CA', input.assessmentId, input.claimToken)
  const safeLink = escapeHtml(link)
  const subject = fr ? 'Récupérez votre rapport de continuité' : 'Claim your continuity report'
  const html = fr
    ? `<p>Merci pour votre achat.</p><p>Pour lier ce rapport au compte institutionnel avec lequel vous l’avez acheté, ouvrez ce lien en étant connecté avec la même adresse courriel :</p><p><a href="${safeLink}">${safeLink}</a></p><p>Le lien est à usage unique et expire dans 30 jours.</p>`
    : `<p>Thank you for your purchase.</p><p>To bind this report to your institutional account, open this link while signed in with the e-mail address you purchased with:</p><p><a href="${safeLink}">${safeLink}</a></p><p>The link can be used once and expires in 30 days.</p>`

  const result = await sendEmail({ to: [{ email, name: email }], subject, html })
  return result.success ? { delivered: true } : { delivered: false, reason: 'SEND_FAILED' }
}
