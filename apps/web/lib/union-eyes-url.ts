export const PUBLIC_UNION_EYES_URL = 'https://app.unioneyes.app';

const RETIRED_UNION_EYES_ORIGIN =
  'https://nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io';

export function resolveUnionEyesUrl(configured?: string): string {
  const value = (configured ?? 'http://localhost:3003').replace(/\/$/, '');
  if (value === RETIRED_UNION_EYES_ORIGIN) {
    return PUBLIC_UNION_EYES_URL;
  }
  return value;
}
