import { Buffer } from 'node:buffer';

/** Bound filenames by Unicode code points and normalize malformed UTF-16
 * before URI encoding. Accepted filenames must not fail after audit commit. */
export function documentAttachmentName(raw: string | null | undefined): string {
  const base = (raw ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  const wellFormed = Buffer.from(cleaned, 'utf8').toString('utf8');
  return Array.from(wellFormed).slice(0, 200).join('') || 'document';
}
