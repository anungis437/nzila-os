/**
 * ARTIFACT TYPE: Server Helper
 * DOCTRINE_VERSION: 1.0.0
 *
 * Server-side verification of Cloudflare Turnstile tokens.
 * Env-gated: when TURNSTILE_SECRET_KEY is unset, verification is treated
 * as satisfied (development / private envs). When configured, verifies
 * the token against the CF challenges endpoint with a tight timeout.
 *
 * Silent on network failure: returns { success: false } and lets the caller
 * decide whether to hard-block. Never throws.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VERIFY_TIMEOUT_MS = 4000;

export interface TurnstileVerifyResult {
  success: boolean;
  /** True when no secret is configured \u2014 caller should treat the gate as open. */
  notConfigured: boolean;
  errorCodes?: string[];
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { success: true, notConfigured: true };
  }
  if (!token) {
    return { success: false, notConfigured: false, errorCodes: ['missing-token'] };
  }

  const params = new URLSearchParams();
  params.set('secret', secret);
  params.set('response', token);
  if (remoteIp) params.set('remoteip', remoteIp);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { success: false, notConfigured: false, errorCodes: [`http-${res.status}`] };
    }
    const data = (await res.json()) as {
      success?: boolean;
      'error-codes'?: string[];
    };
    return {
      success: Boolean(data.success),
      notConfigured: false,
      errorCodes: data['error-codes'],
    };
  } catch {
    return { success: false, notConfigured: false, errorCodes: ['network-error'] };
  } finally {
    clearTimeout(timer);
  }
}
