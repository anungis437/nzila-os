import { describe, expect, it } from 'vitest';
import { PUBLIC_UNION_EYES_URL, resolveUnionEyesUrl } from './union-eyes-url';

describe('resolveUnionEyesUrl', () => {
  it('sends the retired container app hostname to the public app', () => {
    expect(
      resolveUnionEyesUrl(
        'https://nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io',
      ),
    ).toBe(PUBLIC_UNION_EYES_URL);
  });

  it('keeps the public app url and local dev url', () => {
    expect(resolveUnionEyesUrl(PUBLIC_UNION_EYES_URL)).toBe(PUBLIC_UNION_EYES_URL);
    expect(resolveUnionEyesUrl('http://localhost:3003')).toBe('http://localhost:3003');
    expect(resolveUnionEyesUrl(undefined)).toBe('http://localhost:3003');
  });
});
