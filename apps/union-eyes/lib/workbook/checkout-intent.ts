import { createHash, randomBytes } from 'node:crypto';

export const WORKBOOK_CHECKOUT_INTENT_TTL_MS = 60 * 60 * 1000;

export function issueWorkbookCheckoutReference(): { publicRef: string; publicRefHash: string } {
  const publicRef = randomBytes(32).toString('base64url');
  return { publicRef, publicRefHash: hashWorkbookCheckoutReference(publicRef) };
}

export function hashWorkbookCheckoutReference(publicRef: string): string {
  return createHash('sha256').update(publicRef, 'utf8').digest('hex');
}

export function workbookCheckoutReferenceIsPlausible(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}
