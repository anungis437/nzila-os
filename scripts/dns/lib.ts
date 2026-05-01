import dns from 'node:dns/promises';

type SupportedDnsProvider = 'cloudflare' | 'route53' | 'azure_dns';

type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'TXT';

export interface DesiredDnsRecord {
  type: DnsRecordType;
  name: string;
  content: string;
  proxied?: boolean;
  ttl?: number;
  comment?: string;
}

export interface DnsConfig {
  provider: SupportedDnsProvider;
  zoneName: string;
  zoneId: string;
  apiToken: string;
  ttl: number;
  prodTarget: string;
  stagingTarget: string;
}

const DEFAULT_PROD_TARGET = 'nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io';
const DEFAULT_STAGING_TARGET = 'nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io';

function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue;
  return value.trim().toLowerCase() === 'true';
}

export function parseArgs(argv: string[]) {
  const args = new Set(argv.slice(2));
  return {
    dryRun: args.has('--dry-run'),
    allowDelete: args.has('--allow-delete'),
    strict: args.has('--strict'),
    includeOptional: parseBoolean(process.env.DNS_INCLUDE_OPTIONAL_RECORDS, false),
  };
}

function validateTargetHost(target: string, key: string): string {
  const normalized = target.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!normalized || normalized.includes('/')) {
    throw new Error(`${key} must be a hostname (no protocol/path): ${target}`);
  }
  return normalized;
}

export function getDnsConfig(): DnsConfig {
  const providerRaw = (process.env.DNS_PROVIDER || '').trim().toLowerCase();
  const provider = providerRaw as SupportedDnsProvider;

  if (!provider || !['cloudflare', 'route53', 'azure_dns'].includes(provider)) {
    throw new Error('DNS_PROVIDER must be one of: cloudflare, route53, azure_dns');
  }

  const zoneName = (process.env.DNS_ZONE_NAME || 'unioneyes.app').trim().toLowerCase();
  const zoneId = (process.env.DNS_ZONE_ID || '').trim();
  const apiToken = (process.env.DNS_API_TOKEN || '').trim();
  const ttlRaw = (process.env.GODADDY_DNS_TTL || process.env.DNS_TTL || '600').trim();
  const ttl = Number.parseInt(ttlRaw, 10);

  if (!zoneName) {
    throw new Error('DNS_ZONE_NAME is required');
  }

  if (!Number.isFinite(ttl) || ttl < 60) {
    throw new Error('DNS_TTL/GODADDY_DNS_TTL must be a number >= 60');
  }

  if (!zoneId) {
    throw new Error('DNS_ZONE_ID is required');
  }

  if (!apiToken) {
    throw new Error('DNS_API_TOKEN is required');
  }

  const prodTarget = validateTargetHost(process.env.DNS_PROD_ORIGIN || DEFAULT_PROD_TARGET, 'DNS_PROD_ORIGIN');
  const stagingTarget = validateTargetHost(process.env.DNS_STAGING_ORIGIN || DEFAULT_STAGING_TARGET, 'DNS_STAGING_ORIGIN');

  return {
    provider,
    zoneName,
    zoneId,
    apiToken,
    ttl,
    prodTarget,
    stagingTarget,
  };
}

function optionalRecord(name: string, target: string | undefined, ttl: number): DesiredDnsRecord[] {
  if (!target) return [];
  return [
    {
      type: 'CNAME',
      name,
      content: validateTargetHost(target, `DNS_OPTIONAL_${name.toUpperCase()}_TARGET`),
      proxied: false,
      ttl,
      comment: 'managed-by=nzila-dns-sync optional',
    },
  ];
}

export function getDesiredRecords(config: DnsConfig, includeOptional: boolean): DesiredDnsRecord[] {
  const required: DesiredDnsRecord[] = [
    {
      type: 'CNAME',
      name: '@',
      content: config.prodTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required',
    },
    {
      type: 'CNAME',
      name: 'www',
      content: config.prodTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required',
    },
    {
      type: 'CNAME',
      name: 'app',
      content: config.prodTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required',
    },
    {
      type: 'CNAME',
      name: 'staging',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required',
    },
    {
      type: 'CNAME',
      name: 'staging-app',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required',
    },
    // Production control-plane (CRITICAL for production gate)
    {
      type: 'CNAME',
      name: 'control',
      content: config.prodTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-production',
    },
    // Production admin
    {
      type: 'CNAME',
      name: 'admin',
      content: config.prodTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-production',
    },
    // Staging subdomains for all apps
    {
      type: 'CNAME',
      name: 'staging-flow',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-staging',
    },
    {
      type: 'CNAME',
      name: 'staging-web',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-staging',
    },
    {
      type: 'CNAME',
      name: 'staging-console',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-staging',
    },
    {
      type: 'CNAME',
      name: 'staging-partners',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-staging',
    },
    {
      type: 'CNAME',
      name: 'staging-cfo',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-staging',
    },
    {
      type: 'CNAME',
      name: 'staging-zonga',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-staging',
    },
    {
      type: 'CNAME',
      name: 'staging-agrimo',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-staging',
    },
    {
      type: 'CNAME',
      name: 'staging-cora',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-staging',
    },
    {
      type: 'CNAME',
      name: 'staging-trade',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-staging',
    },
    {
      type: 'CNAME',
      name: 'staging-mobility',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-staging',
    },
    {
      type: 'CNAME',
      name: 'staging-control',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-staging',
    },
    {
      type: 'CNAME',
      name: 'staging-api',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-staging',
    },
    {
      type: 'CNAME',
      name: 'staging-faircase',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-staging',
    },
    {
      type: 'CNAME',
      name: 'staging-admin',
      content: config.stagingTarget,
      proxied: false,
      ttl: config.ttl,
      comment: 'managed-by=nzila-dns-sync required-staging',
    },
  ];

  if (!includeOptional) {
    return required;
  }

  return [
    ...required,
    ...optionalRecord('docs', process.env.DNS_OPTIONAL_DOCS_TARGET, config.ttl),
    ...optionalRecord('status', process.env.DNS_OPTIONAL_STATUS_TARGET, config.ttl),
    ...optionalRecord('api', process.env.DNS_OPTIONAL_API_TARGET, config.ttl),
  ];
}

export interface CloudflareRecord {
  id: string;
  type: DnsRecordType;
  name: string;
  content: string;
  proxied?: boolean;
  ttl?: number;
  comment?: string;
}

interface CloudflareApiResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

async function cloudflareRequest<T>(
  config: DnsConfig,
  path: string,
  init: RequestInit = {},
): Promise<CloudflareApiResponse<T>> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let payload: CloudflareApiResponse<T> | null = null;

  try {
    payload = JSON.parse(text) as CloudflareApiResponse<T>;
  } catch {
    throw new Error(`Cloudflare API non-JSON response (${response.status}): ${text.slice(0, 400)}`);
  }

  if (!response.ok || !payload.success) {
    const errorMessage = payload.errors?.map((e) => `${e.code}:${e.message}`).join(', ') || text;
    throw new Error(`Cloudflare API request failed (${response.status}): ${errorMessage}`);
  }

  return payload;
}

export async function checkCloudflareAccess(config: DnsConfig): Promise<void> {
  const zoneResult = await cloudflareRequest<{ id: string; name: string }>(
    config,
    `/zones/${config.zoneId}`,
    { method: 'GET' },
  );

  if (!zoneResult.result?.id || zoneResult.result.id !== config.zoneId) {
    throw new Error('Cloudflare zone read check failed: zone id mismatch');
  }

  if (zoneResult.result.name.toLowerCase() !== config.zoneName.toLowerCase()) {
    throw new Error(
      `Cloudflare zone name mismatch: expected ${config.zoneName}, got ${zoneResult.result.name}`,
    );
  }
}

export async function listCloudflareRecords(config: DnsConfig): Promise<CloudflareRecord[]> {
  const result = await cloudflareRequest<CloudflareRecord[]>(
    config,
    `/zones/${config.zoneId}/dns_records?per_page=5000`,
    { method: 'GET' },
  );

  return result.result;
}

export function normalizeRecordName(name: string, zoneName: string): string {
  const normalizedZone = zoneName.toLowerCase();
  const normalized = name.toLowerCase();
  if (normalized === normalizedZone) {
    return '@';
  }
  if (normalized.endsWith(`.${normalizedZone}`)) {
    return normalized.slice(0, -(normalizedZone.length + 1));
  }
  return normalized;
}

export function recordKey(record: Pick<DesiredDnsRecord, 'type' | 'name'>): string {
  return `${record.type}:${record.name.toLowerCase()}`;
}

export async function upsertCloudflareRecord(
  config: DnsConfig,
  desired: DesiredDnsRecord,
  existing: CloudflareRecord | undefined,
): Promise<'created' | 'updated' | 'unchanged'> {
  const payload = {
    type: desired.type,
    name: desired.name,
    content: desired.content,
    ttl: desired.ttl ?? 600,
    proxied: desired.proxied ?? false,
    comment: desired.comment,
  };

  if (!existing) {
    await cloudflareRequest(config, `/zones/${config.zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return 'created';
  }

  const needsUpdate =
    existing.content !== desired.content ||
    Boolean(existing.proxied) !== Boolean(desired.proxied) ||
    (existing.ttl ?? 600) !== (desired.ttl ?? 600) ||
    (existing.comment || '') !== (desired.comment || '');

  if (!needsUpdate) {
    return 'unchanged';
  }

  await cloudflareRequest(config, `/zones/${config.zoneId}/dns_records/${existing.id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  return 'updated';
}

export async function deleteCloudflareRecord(config: DnsConfig, recordId: string): Promise<void> {
  await cloudflareRequest(config, `/zones/${config.zoneId}/dns_records/${recordId}`, {
    method: 'DELETE',
  });
}

export async function resolveCnameHost(host: string): Promise<string[]> {
  try {
    return await dns.resolveCname(host);
  } catch {
    return [];
  }
}

export async function resolveA(host: string): Promise<string[]> {
  try {
    return await dns.resolve4(host);
  } catch {
    return [];
  }
}

export async function resolveNs(host: string): Promise<string[]> {
  try {
    return await dns.resolveNs(host);
  } catch {
    return [];
  }
}

export async function checkHttps(url: string): Promise<{ ok: boolean; status: number; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });

    return {
      ok: [200, 301, 302, 307, 308].includes(response.status),
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Unknown HTTPS error',
    };
  } finally {
    clearTimeout(timeout);
  }
}
