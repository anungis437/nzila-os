'use strict';

const assert = require('node:assert/strict');
const DOCUMENT_DOWNLOAD_LEASE_MS = 3600000;
const ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,254}$/;
const HEX = /^[a-f0-9]{64}$/;
const KEYS = ['documentId', 'expiresAt', 'fingerprint', 'issuedAt', 'organizationId', 'userId', 'version', 'versionId'];

function requireContract(condition) {
  assert(condition, 'DOCUMENT_LEASE_URL_CONTRACT_REFUSED');
}

/** Inspect the public URL contract only. This does not authenticate its MAC:
 * successful authenticated app byte reads are the independent server control.
 * Never include the input URL/token in assertion messages or receipt fields. */
function parseDocumentLeaseUrl(value, expected, options = {}) {
  requireContract(typeof value === 'string' && value.length <= 8192);
  requireContract(expected && typeof expected.origin === 'string');
  const origin = new URL(expected.origin);
  requireContract(origin.protocol === 'https:' && origin.href === origin.origin + '/');
  requireContract(['organizationId', 'userId', 'documentId'].every(key => typeof expected[key] === 'string' && ID.test(expected[key])));
  requireContract(value.startsWith('/api/') || (options.allowAbsolute === true && value.startsWith(origin.origin + '/api/')));
  const url = new URL(value, origin);
  requireContract(url.origin === origin.origin && !url.username && !url.password && !url.hash);
  requireContract(url.pathname === '/api/documents/' + expected.documentId + '/content');
  requireContract([...url.searchParams.keys()].length === 1 && url.searchParams.has('lease'));
  const token = url.searchParams.get('lease');
  requireContract(token.length <= 4096);
  const parts = token.split('.');
  requireContract(parts.length === 3 && parts[0] === 'v1' && /^[A-Za-z0-9_-]+$/.test(parts[1]) && /^[A-Za-z0-9_-]{43}$/.test(parts[2]));
  const bytes = Buffer.from(parts[1], 'base64url');
  const mac = Buffer.from(parts[2], 'base64url');
  requireContract(bytes.length <= 2048 && bytes.toString('base64url') === parts[1]
    && mac.length === 32 && mac.toString('base64url') === parts[2]);
  let payload;
  try { payload = JSON.parse(bytes.toString('utf8')); } catch { requireContract(false); }
  requireContract(payload && !Array.isArray(payload) && JSON.stringify(Object.keys(payload).sort()) === JSON.stringify(KEYS));
  requireContract(payload.version === 1 && ['organizationId', 'userId', 'documentId'].every(key => payload[key] === expected[key]));
  requireContract(payload.versionId === null || (typeof payload.versionId === 'string' && ID.test(payload.versionId)));
  requireContract(typeof payload.fingerprint === 'string' && HEX.test(payload.fingerprint));
  requireContract(Number.isSafeInteger(payload.issuedAt) && payload.issuedAt >= 0
    && Number.isSafeInteger(payload.expiresAt) && payload.expiresAt - payload.issuedAt === DOCUMENT_DOWNLOAD_LEASE_MS);
  const canonical = JSON.stringify({ version: 1, organizationId: payload.organizationId, userId: payload.userId,
    documentId: payload.documentId, versionId: payload.versionId, fingerprint: payload.fingerprint,
    issuedAt: payload.issuedAt, expiresAt: payload.expiresAt });
  requireContract(Buffer.from(canonical).toString('base64url') === parts[1]);
  // Reject URL encoding, duplicate queries and normalized path alternatives as
  // well: the encrypted URL is retained byte-for-byte for the actual expiry test.
  requireContract(url.href === origin.origin + '/api/documents/' + expected.documentId + '/content?lease=' + token);
  requireContract(value === url.pathname + url.search || (options.allowAbsolute === true && value === url.href));
  const now = options.now ?? Date.now();
  requireContract(Number.isSafeInteger(now) && now >= 0 && payload.issuedAt <= now);
  requireContract(options.allowExpired === true || now < payload.expiresAt);
  return { url, payload, expiresAt: new Date(payload.expiresAt).toISOString(), expiresAtMs: payload.expiresAt };
}

module.exports = { parseDocumentLeaseUrl, DOCUMENT_DOWNLOAD_LEASE_MS };
