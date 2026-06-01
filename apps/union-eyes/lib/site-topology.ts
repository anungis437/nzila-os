const DEFAULT_PRODUCTION_MARKETING_URL = 'https://unioneyes.app';
const DEFAULT_PRODUCTION_APP_URL = 'https://app.unioneyes.app';
const DEFAULT_STAGING_MARKETING_URL = 'https://staging.unioneyes.app';
const DEFAULT_STAGING_APP_URL = 'https://staging-app.unioneyes.app';

export type UnionEyesEnvironment = 'development' | 'staging' | 'production' | 'test';

type UnionEyesSiteTopology = {
  environment: UnionEyesEnvironment;
  isStaging: boolean;
  marketingUrl: string;
  appUrl: string;
  productionMarketingUrl: string;
  productionAppUrl: string;
  stagingMarketingUrl: string;
  stagingAppUrl: string;
  titleSuffix: string;
};

function normalizeUrl(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  try {
    const normalized = new URL(value);

    // Guard against production/staging misconfiguration where a public host is
    // accidentally set with a local dev port (e.g. :3000). Keep port 3000 only
    // for localhost-style hosts.
    if (
      normalized.port === '3000' &&
      normalized.hostname !== 'localhost' &&
      normalized.hostname !== '127.0.0.1'
    ) {
      normalized.port = '';
    }

    return normalized.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

function resolveEnvironment(): UnionEyesEnvironment {
  const candidate = (
    process.env.UE_ENVIRONMENT
    ?? process.env.NEXT_PUBLIC_APP_ENV
    ?? process.env.NODE_ENV
    ?? 'development'
  ).toLowerCase();

  if (candidate === 'staging') {
    return 'staging';
  }

  if (candidate === 'production') {
    return 'production';
  }

  if (candidate === 'test') {
    return 'test';
  }

  return 'development';
}

export function getUnionEyesSiteTopology(): UnionEyesSiteTopology {
  const environment = resolveEnvironment();
  const isStaging = environment === 'staging';
  const productionMarketingUrl = normalizeUrl(
    process.env.NEXT_PUBLIC_SITE_URL_PRODUCTION ?? process.env.NEXT_PUBLIC_SITE_URL,
    DEFAULT_PRODUCTION_MARKETING_URL,
  );
  const productionAppUrl = normalizeUrl(
    process.env.NEXT_PUBLIC_APP_URL_PRODUCTION ?? process.env.NEXT_PUBLIC_APP_URL,
    DEFAULT_PRODUCTION_APP_URL,
  );
  const stagingMarketingUrl = normalizeUrl(
    process.env.NEXT_PUBLIC_SITE_URL_STAGING,
    DEFAULT_STAGING_MARKETING_URL,
  );
  const stagingAppUrl = normalizeUrl(
    process.env.NEXT_PUBLIC_APP_URL_STAGING,
    DEFAULT_STAGING_APP_URL,
  );

  const marketingUrl = normalizeUrl(
    process.env.UE_MARKETING_URL
      ?? (isStaging ? stagingMarketingUrl : productionMarketingUrl),
    isStaging ? stagingMarketingUrl : productionMarketingUrl,
  );
  const appUrl = normalizeUrl(
    process.env.UE_APP_URL ?? (isStaging ? stagingAppUrl : productionAppUrl),
    isStaging ? stagingAppUrl : productionAppUrl,
  );

  return {
    environment,
    isStaging,
    marketingUrl,
    appUrl,
    productionMarketingUrl,
    productionAppUrl,
    stagingMarketingUrl,
    stagingAppUrl,
    titleSuffix: isStaging ? ' [Staging]' : '',
  };
}

export function buildMarketingUrl(pathname = '/'): string {
  const { marketingUrl } = getUnionEyesSiteTopology();
  return new URL(pathname, `${marketingUrl}/`).toString();
}

export function buildAppUrl(pathname = '/'): string {
  const { appUrl } = getUnionEyesSiteTopology();
  return new URL(pathname, `${appUrl}/`).toString();
}
