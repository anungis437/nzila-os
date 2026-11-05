/**
 * SCIM user changes from an identity provider: a PATCH (RFC 7644 section 3.5.2) or a PUT of the user resource.
 *
 * Identity providers differ in how they say the same thing: Entra sends `"op": "Replace"` and `"value": "False"` for active, Okta sends a
 * path-less `{ "op": "replace", "value": { "active": false } }`. Both are read here. A path that names an attribute this service does not change is
 * a 400 that names it (invalidPath), never an operation that is accepted and then not applied, so a change that did not happen cannot be mistaken
 * for one that did. A PUT states attributes to update; an attribute it omits is left as it is, and read-only attributes it echoes back (id, meta,
 * groups) are ignored as the RFC requires. A non-empty `roles` is refused: nothing in SCIM provisioning confers a role.
 */
import { ScimHttpError } from '@/lib/scim/responses';

export interface ScimUserChanges {
  active?: boolean;
  userName?: string;
  /** `null` removes it. */
  externalId?: string | null;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  email?: string;
}

const PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:patchop';
const CORE_USER_PREFIX = /^urn:ietf:params:scim:schemas:core:2\.0:user:/i;
const MAX_OPERATIONS = 20;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_VALUE_PATH = /^emails(?:\[(?:type eq "work"|primary eq true)\])?\.value$/i;
const EMAILS_FILTERED_PATH = /^emails\[(?:type eq "work"|primary eq true)\]$/i;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const invalid = (message: string) => new ScimHttpError(400, message, 'invalidValue');

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.trim() === '' || value.trim().length > max) throw invalid(`${label} must be text of 1 to ${max} characters`);
  return value.trim();
}

function flag(value: unknown, label: string): boolean {
  if (typeof value === 'boolean') return value;
  const spelled = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (spelled === 'true') return true;
  if (spelled === 'false') return false;
  throw invalid(`${label} must be true or false`);
}

function address(value: unknown, label: string): string {
  const candidate = text(value, label, 320);
  if (!EMAIL.test(candidate)) throw invalid(`${label} must be an e-mail address`);
  return candidate;
}

/** The primary address of an emails value, else the first. */
function primaryEmail(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10) throw invalid('emails must be a list of 1 to 10 addresses');
  const entries = value.filter(isObject);
  const chosen = entries.find((entry) => entry.primary === true) ?? entries[0];
  if (!chosen) throw invalid('emails must be a list of addresses');
  return address(chosen.value, 'emails.value');
}

function setName(draft: ScimUserChanges, value: unknown): void {
  if (!isObject(value)) throw invalid('name must be an object');
  if (value.givenName !== undefined) draft.givenName = text(value.givenName, 'name.givenName', 100);
  if (value.familyName !== undefined) draft.familyName = text(value.familyName, 'name.familyName', 100);
  if (value.formatted !== undefined) draft.displayName = text(value.formatted, 'name.formatted', 200);
}

function apply(draft: ScimUserChanges, rawPath: string, value: unknown, operation: 'add' | 'replace' | 'remove'): void {
  const path = rawPath.trim().replace(CORE_USER_PREFIX, '').toLowerCase();
  if (operation === 'remove') {
    if (path === 'externalid') {
      draft.externalId = null;
      return;
    }
    throw new ScimHttpError(400, `${rawPath} cannot be removed`, 'mutability');
  }
  if (path === 'active') draft.active = flag(value, 'active');
  else if (path === 'username') draft.userName = text(value, 'userName', 320);
  else if (path === 'externalid') draft.externalId = text(value, 'externalId', 255);
  else if (path === 'displayname') draft.displayName = text(value, 'displayName', 200);
  else if (path === 'name.givenname') draft.givenName = text(value, 'name.givenName', 100);
  else if (path === 'name.familyname') draft.familyName = text(value, 'name.familyName', 100);
  else if (path === 'name.formatted') draft.displayName = text(value, 'name.formatted', 200);
  else if (path === 'name') setName(draft, value);
  else if (path === 'emails') draft.email = primaryEmail(value);
  else if (EMAIL_VALUE_PATH.test(path)) draft.email = address(value, 'emails.value');
  else if (EMAILS_FILTERED_PATH.test(path)) draft.email = primaryEmail([{ value: isObject(value) ? value.value : value, primary: true }]);
  else throw new ScimHttpError(400, `${rawPath} is not an attribute that can be changed here`, 'invalidPath');
}

export function parseScimPatch(body: unknown): ScimUserChanges {
  if (!isObject(body)) throw new ScimHttpError(400, 'The request body must be a SCIM PatchOp message', 'invalidSyntax');
  const schemas = Array.isArray(body.schemas) ? body.schemas.map((schema) => String(schema).toLowerCase()) : [];
  if (!schemas.includes(PATCH_SCHEMA)) throw new ScimHttpError(400, 'The request body must declare the PatchOp message schema', 'invalidSyntax');
  const operations = body.Operations ?? body.operations;
  if (!Array.isArray(operations) || operations.length === 0 || operations.length > MAX_OPERATIONS) {
    throw new ScimHttpError(400, `Operations must be a list of 1 to ${MAX_OPERATIONS} operations`, 'invalidSyntax');
  }
  const draft: ScimUserChanges = {};
  for (const entry of operations) {
    if (!isObject(entry) || typeof entry.op !== 'string') throw new ScimHttpError(400, 'Every operation names its op', 'invalidSyntax');
    const operation = entry.op.trim().toLowerCase();
    if (operation !== 'add' && operation !== 'replace' && operation !== 'remove') throw new ScimHttpError(400, `Operation ${entry.op} is not supported`, 'invalidSyntax');
    if (typeof entry.path === 'string' && entry.path.trim() !== '') {
      apply(draft, entry.path, entry.value, operation);
      continue;
    }
    if (operation === 'remove') throw new ScimHttpError(400, 'A remove operation names the attribute it removes', 'noTarget');
    if (!isObject(entry.value)) throw invalid('An operation without a path carries an object of attributes');
    for (const [key, attribute] of Object.entries(entry.value)) apply(draft, key, attribute, operation);
  }
  return draft;
}

/** The attributes a PUT of the user resource states. */
export function parseScimUserResource(body: unknown): ScimUserChanges {
  if (!isObject(body)) throw new ScimHttpError(400, 'The request body must be a SCIM User resource', 'invalidSyntax');
  const draft: ScimUserChanges = { userName: text(body.userName, 'userName', 320) };
  if (Array.isArray(body.roles) ? body.roles.length > 0 : body.roles !== undefined && body.roles !== null) {
    throw invalid('roles are not set by provisioning');
  }
  if (body.active !== undefined) draft.active = flag(body.active, 'active');
  if (body.externalId !== undefined && body.externalId !== null) draft.externalId = text(body.externalId, 'externalId', 255);
  if (body.displayName !== undefined && body.displayName !== null) draft.displayName = text(body.displayName, 'displayName', 200);
  if (body.name !== undefined && body.name !== null) setName(draft, body.name);
  if (Array.isArray(body.emails) && body.emails.length > 0) draft.email = primaryEmail(body.emails);
  return draft;
}
