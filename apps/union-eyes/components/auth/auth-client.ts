/**
 * Requests the sign-in screens make to the platform auth routes (/api/auth/*).
 *
 * These routes answer plain JSON, not withApi's envelope: a success is an object ({ user }, { message }, { ok: true } ...) and a failure is
 * { error: "..." } (or the standard { message }). A request that never reached the server, an answer that is not JSON and a refusal are
 * three different things, and each ends as a message for the person: none of them is swallowed, and none is read as a success.
 */
import { isRecord, readApiError } from '@/lib/client/api-envelope';

export const NETWORK_MESSAGE = 'Could not reach the server. Check your connection and try again.';
export const UNEXPECTED_MESSAGE = 'The server answered in a way this page does not understand. Please try again.';

export type AuthAnswer = { ok: true; data: Record<string, unknown> } | { ok: false; message: string };

async function answerOf(request: Promise<Response>, fallback: string): Promise<AuthAnswer> {
  let response: Response;
  try {
    response = await request;
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
  if (!response.ok) return { ok: false, message: await readApiError(response, fallback) };
  const data: unknown = await response.json().catch(() => null);
  return isRecord(data) ? { ok: true, data } : { ok: false, message: UNEXPECTED_MESSAGE };
}

export function postJson(url: string, body: unknown, fallback: string): Promise<AuthAnswer> {
  return answerOf(
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    fallback,
  );
}

export function getJson(url: string, fallback: string): Promise<AuthAnswer> {
  return answerOf(fetch(url, { cache: 'no-store' }), fallback);
}

/** A page's own language from its address (/fr-CA/...): the destination after sign-in stays in it. */
export function localeOfPath(pathname: string | null, locales: readonly string[], fallback: string): string {
  const first = (pathname ?? '').split('/')[1] ?? '';
  return locales.includes(first) ? first : fallback;
}
