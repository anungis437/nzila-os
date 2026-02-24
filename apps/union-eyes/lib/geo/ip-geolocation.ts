export interface IpGeolocation {
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
}

function normalizeIp(rawIp: string | null | undefined): string | null {
  if (!rawIp) return null;

  const first = rawIp.split(',')[0]?.trim();
  if (!first || first.toLowerCase() === 'unknown') return null;

  let ip = first;
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }

  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.split(':')[0];
  }

  return ip;
}

function isPrivateIp(ip: string): boolean {
  if (ip === '::1') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true;

  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  const [a, b] = parts.map((part) => Number(part));
  if ([a, b].some((value) => Number.isNaN(value))) return false;

  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;

  return false;
}

export async function resolveIpGeolocation(rawIp: string | null | undefined): Promise<IpGeolocation> {
  const ip = normalizeIp(rawIp);
  if (!ip || isPrivateIp(ip)) return {};

  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!response.ok) return {};

    const data = await response.json();
    if (data?.error) return {};

    return {
      city: data.city || undefined,
      region: data.region || undefined,
      country: data.country_code || undefined,
      latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
      longitude: typeof data.longitude === 'number' ? data.longitude : undefined,
      timezone: data.timezone || undefined,
      isp: data.org || undefined,
    };
  } catch (_error) {
return {};
  }
}
