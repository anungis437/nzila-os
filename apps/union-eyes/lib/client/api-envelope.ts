/**
 * Reads what the application's own API answers, for browser code.
 *
 * withApi wraps whatever a handler returns as { success, data, timestamp }, so a handler that returns { data: row } (every crud-factory
 * item and list route) arrives as { success, data: { data: row } }. A failed call carries the standard error body { code, message, ... },
 * or { error: { message } } from a retired route. Nothing here substitutes a default: a body that is not the shape the caller expects is
 * an error for the caller to show, never an empty list or a blank record.
 */

export class ApiShapeError extends Error {
  constructor(what: string) {
    super(`Unexpected API response: ${what}`);
    this.name = 'ApiShapeError';
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What a withApi route returned: the body's `data`. */
export function envelopeData(body: unknown): Record<string, unknown> {
  if (isRecord(body) && isRecord(body.data)) return body.data;
  throw new ApiShapeError('no data');
}

/** The record of an item route, which returns { data: record }. */
export function envelopeRow(body: unknown): Record<string, unknown> {
  const payload = envelopeData(body);
  if (isRecord(payload.data)) return payload.data;
  throw new ApiShapeError('no record');
}

/** The records of a list route, which returns { data: records }. */
export function envelopeRows(body: unknown): unknown[] {
  const payload = envelopeData(body);
  if (Array.isArray(payload.data)) return payload.data;
  throw new ApiShapeError('no list');
}

/** The page count of a list route, which returns { data, pagination: { totalPages } }; a list whose pages are unknown is not shown as one page. */
export function envelopePages(body: unknown): number {
  const { pagination } = envelopeData(body);
  if (isRecord(pagination) && typeof pagination.totalPages === 'number' && Number.isFinite(pagination.totalPages)) return pagination.totalPages;
  throw new ApiShapeError('no page count');
}

/**
 * The message a failed answer states, from the body that was already read: `message` (the framework's own `{ code, message }`), `error.message` or `error` (a route's own), or the AI feature
 * guard's `reason` with its `fallbackAdvice`.
 * A body that names none gives the fallback. A screen never reads `body.error` itself: depending on the route it is a string, an object, or not there at all.
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  if (isRecord(body)) {
    if (typeof body.message === 'string' && body.message) return body.message;
    if (isRecord(body.error) && typeof body.error.message === 'string' && body.error.message) return body.error.message;
    if (typeof body.error === 'string' && body.error) return body.error;
    // The AI feature guard refuses with { available: false, reason, fallbackAdvice }: the reason, and then what to do about it.
    if (typeof body.reason === 'string' && body.reason) {
      return typeof body.fallbackAdvice === 'string' && body.fallbackAdvice ? `${body.reason} ${body.fallbackAdvice}` : body.reason;
    }
  }
  return fallback;
}

/** The message a failed response states; the fallback when its body is not JSON or names none. */
export async function readApiError(response: Response, fallback: string): Promise<string> {
  return apiErrorMessage(await response.json().catch(() => null), fallback);
}

/**
 * What a failed request says to the person using the screen. A request the route answered with a refusal fails with an Error made from the message it stated (`apiErrorMessage`),
 * and that is shown. A request that never got an answer fails with a TypeError whose text is the browser's own ("Failed to fetch", "Load failed"): the screen's fallback is shown instead.
 */
export function failureText(error: unknown, fallback: string): string {
  return error instanceof Error && !(error instanceof TypeError) && error.message ? error.message : fallback;
}

export type FailureLanguage = 'en' | 'fr';

export const failureLanguage = (locale: string | null | undefined): FailureLanguage =>
  locale?.toLowerCase().startsWith('fr') ? 'fr' : 'en';

const STATUS_COPY: Readonly<Record<FailureLanguage, Readonly<Record<number, string>>>> = {
  en: {
    401: 'Your session has ended. Sign in again to continue.',
    403: 'You do not have permission to do this.',
    404: 'This item is no longer available.',
    409: 'This item changed while you were working. Refresh and try again.',
    413: 'The file or request is too large.',
    429: 'Too many requests. Wait a moment and try again.',
    500: 'The service is temporarily unavailable. Try again shortly.',
    501: 'This feature is not available yet.',
    502: 'The service is temporarily unavailable. Try again shortly.',
    503: 'The service is temporarily unavailable. Try again shortly.',
    504: 'The service took too long to answer. Try again shortly.',
  },
  fr: {
    401: 'Votre session est terminée. Reconnectez-vous pour continuer.',
    403: 'Vous n’avez pas l’autorisation d’effectuer cette action.',
    404: 'Cet élément n’est plus disponible.',
    409: 'Cet élément a changé pendant votre travail. Actualisez, puis réessayez.',
    413: 'Le fichier ou la demande est trop volumineux.',
    429: 'Trop de demandes. Patientez un instant, puis réessayez.',
    500: 'Le service est momentanément indisponible. Réessayez sous peu.',
    501: 'Cette fonction n’est pas encore disponible.',
    502: 'Le service est momentanément indisponible. Réessayez sous peu.',
    503: 'Le service est momentanément indisponible. Réessayez sous peu.',
    504: 'Le service a mis trop de temps à répondre. Réessayez sous peu.',
  },
};

/** What a screen says when nothing more specific is known: never a status line, exception text or the browser's own wording. */
export const GENERIC_FAILURE: Readonly<Record<FailureLanguage, string>> = {
  en: 'Something went wrong. Try again.',
  fr: 'Une erreur s’est produite. Réessayez.',
};

/**
 * The server states its refusals in English. A French screen shows one of these only when it is a message we hold a French wording for;
 * every other refusal is worded from its status, or by the screen's own French fallback.
 */
const BARE_SERVER_MESSAGES: ReadonlySet<string> = new Set(['Unauthorized', 'Forbidden', 'Not found', 'Internal server error']);

const FRENCH_SERVER_MESSAGES: Readonly<Record<string, string>> = {
  'Internal server error': 'Le service est momentanément indisponible. Réessayez sous peu.',
  'Unauthorized': STATUS_COPY.fr[401],
  'Forbidden': STATUS_COPY.fr[403],
  'Not found': STATUS_COPY.fr[404],
};

/** A request the route answered with a refusal. `message` is what the server stated; it is shown only by `userFailureText`'s rules. */
export class ApiFailure extends Error {
  readonly status: number;
  readonly code: string | null;
  /** The reason the server stated, '' when it stated none; `message` may carry a developer-facing wording for callers that only log it. */
  readonly stated: string;
  constructor(status: number, stated: string, code: string | null = null, message: string = stated) {
    super(message);
    this.name = 'ApiFailure';
    this.status = status;
    this.code = code;
    this.stated = stated;
  }
}

/** The refusal a failed response states. A body that names no message leaves `message` empty, so the screen's fallback or the status wording is shown. */
export async function readApiFailure(response: Response, loggedMessage?: string): Promise<ApiFailure> {
  const body: unknown = await response.json().catch(() => null);
  const code = isRecord(body) && typeof body.code === 'string' ? body.code : null;
  const stated = apiErrorMessage(body, '');
  return new ApiFailure(response.status, stated, code, stated || loggedMessage || '');
}

/**
 * The words a person reads for a failure, in their language.
 *
 * An `ApiFailure` shows the server's stated reason in English only; in French it shows a held translation, else the wording of its status
 * (sign-in, permission, missing, changed, too large, busy, not available), else the screen's own fallback. Anything else (a TypeError from a
 * request that got no answer, an ApiShapeError, a thrown string, an `HTTP 500` line) shows the screen's fallback and never its own text.
 */
export function userFailureText(error: unknown, fallback: string | null, language: FailureLanguage): string {
  return statedText(error, language) || fallback || GENERIC_FAILURE[language];
}

function statedText(error: unknown, language: FailureLanguage): string {
  if (!(error instanceof ApiFailure)) return '';
  // Never expose server implementation details carried by 5xx responses, even when a backend includes a message.
  if (error.status >= 500) return STATUS_COPY[language][error.status] || STATUS_COPY[language][500];
  if (language === 'en') return (error.stated && !BARE_SERVER_MESSAGES.has(error.stated) ? error.stated : STATUS_COPY.en[error.status]) || error.stated || '';
  return FRENCH_SERVER_MESSAGES[error.stated] ?? STATUS_COPY.fr[error.status] ?? '';
}

/** The words for a response that was not ok, read once from its body. */
export async function readUserFailure(response: Response, fallback: string | null, language: FailureLanguage): Promise<string> {
  return userFailureText(await readApiFailure(response), fallback, language);
}

/**
 * The line a screen may add under its own message: what the server stated about a refusal, in the person's language, or null when the failure
 * says nothing a person can use (no answer, a body that is not the expected shape, a refusal with no statement and no status wording).
 */
export function failureDetail(error: unknown, language: FailureLanguage): string | null {
  return statedText(error, language) || null;
}
