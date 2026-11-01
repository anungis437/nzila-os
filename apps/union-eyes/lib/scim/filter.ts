/**
 * The one SCIM filter an identity provider needs to provision: has this person already been provisioned. `userName eq "x"` and
 * `externalId eq "x"` are exact lookups of a person this stream provisioned. Any other filter is refused (400 invalidFilter), not run as if it were
 * understood, so an unsupported filter cannot be mistaken for "no such person" and cause a duplicate to be created.
 */
import { ScimHttpError } from '@/lib/scim/responses';

export interface ScimFilter {
  attribute: 'userName' | 'externalId';
  value: string;
}

const FILTER = /^\s*(userName|externalId)\s+eq\s+"((?:[^"\\]|\\.)*)"\s*$/i;
const MAX_FILTER_LENGTH = 500;
const MAX_VALUE_LENGTH = 320;

/** null when no filter was given. */
export function parseScimFilter(filter: string | null): ScimFilter | null {
  if (filter === null || filter.trim() === '') return null;
  if (filter.length > MAX_FILTER_LENGTH) throw new ScimHttpError(400, 'The filter is too long', 'invalidFilter');
  const match = FILTER.exec(filter);
  if (!match) throw new ScimHttpError(400, 'Only userName eq "value" and externalId eq "value" filters are supported', 'invalidFilter');
  const value = match[2].replace(/\\(.)/g, '$1');
  if (value.trim() === '' || value.length > MAX_VALUE_LENGTH) throw new ScimHttpError(400, 'The filter value must be 1 to 320 characters', 'invalidFilter');
  return { attribute: match[1].toLowerCase() === 'username' ? 'userName' : 'externalId', value };
}
