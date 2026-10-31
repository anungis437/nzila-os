const NETWORK_KEYS = new Set(['ipAddress', 'ip_address', 'userAgent', 'user_agent', 'geolocation']);

/**
 * A signature record carries the network address, device and location each person signed from. That is evidence for the
 * sender, who is accountable for the request, and for the person it describes; it is not something one signer, or an
 * external counterparty with a platform account, may read about another. Rows that describe the viewer are kept whole.
 */
export function redactSignerNetworkData<T>(value: T, viewerUserId: string): T {
  if (Array.isArray(value)) return value.map((item) => redactSignerNetworkData(item, viewerUserId)) as T;
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  const row = value as Record<string, unknown>;
  if (row.userId === viewerUserId || row.actorUserId === viewerUserId) return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(row)) {
    if (NETWORK_KEYS.has(key)) continue;
    output[key] = redactSignerNetworkData(entry, viewerUserId);
  }
  return output as T;
}

/** The sender sees every signer's evidence; any other viewer sees only their own. */
export function signatureViewForViewer<T>(value: T, viewerUserId: string, senderUserId: string | null | undefined): T {
  return senderUserId === viewerUserId ? value : redactSignerNetworkData(value, viewerUserId);
}
