const PRIVATE_KEYS = new Set([
  'ipAddress', 'ip_address', 'userAgent', 'user_agent', 'geolocation',
  'email', 'emailAddress', 'email_address', 'signerEmail', 'signer_email',
  'recipientEmail', 'recipient_email',
]);

/**
 * A signer can see their own identity and network evidence; the sender can see
 * the full audit. Other signers' contact addresses, devices, locations and
 * free-form audit descriptions must not be exposed to a peer signer.
 *
 * Recursion is mandatory even when the outer object belongs to the viewer:
 * a document or report may embed a collection of other signers.
 */
export function redactSignerNetworkData<T>(value: T, viewerUserId: string): T {
  if (Array.isArray(value)) return value.map((item) => redactSignerNetworkData(item, viewerUserId)) as T;
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  const row = value as Record<string, unknown>;
  const ownRow = row.userId === viewerUserId || row.actorUserId === viewerUserId;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(row)) {
    if (!ownRow && PRIVATE_KEYS.has(key)) continue;
    // Event descriptions are unstructured and can contain signer email, IP or location
    // even if the typed columns were redacted. Keep eventType and timestamps instead.
    if (!ownRow && key === 'eventDescription') continue;
    output[key] = redactSignerNetworkData(entry, viewerUserId);
  }
  return output as T;
}

/** The sender sees every signer's evidence; any other viewer sees only their own. */
export function signatureViewForViewer<T>(value: T, viewerUserId: string, senderUserId: string | null | undefined): T {
  return senderUserId === viewerUserId ? value : redactSignerNetworkData(value, viewerUserId);
}
