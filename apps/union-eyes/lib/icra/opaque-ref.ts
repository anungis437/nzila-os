import { createHash } from 'node:crypto';

/**
 * A short, one-way reference for a bearer identifier in a log line. A workbook or assessment id is a capability: whoever has it can
 * act on the record, so it is never written to a log. The reference lets an operator correlate lines of one record without holding it.
 */
export function opaqueRef(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 12);
}
