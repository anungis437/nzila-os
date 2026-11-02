import { describe, expect, it } from 'vitest';
import { SecretPatternSchema, ScanResultSchema } from '../scanner';
import { RotationPolicySchema } from '../rotation';

describe('Zod 4 secrets contracts', () => {
  it('preserves scanner and rotation defaults', () => {
    expect(SecretPatternSchema.parse({ name: 'key', pattern: 'sk_[a-z]+', severity: 'high', description: 'test' }).severity).toBe('high');
    expect(ScanResultSchema.parse({ file: 'test.ts', line: 1, pattern: 'key', severity: 'critical', match: 'secret', redacted: '***' }).line).toBe(1);
    expect(RotationPolicySchema.parse({ secretName: 'key', rotationType: 'api_key' }).rotationIntervalDays).toBe(90);
  });
  it('rejects unsupported severities and invalid rotation types', () => {
    expect(SecretPatternSchema.safeParse({ name: 'key', pattern: '.', severity: 'urgent', description: 'test' }).success).toBe(false);
    expect(RotationPolicySchema.safeParse({ secretName: 'key', rotationType: 'invalid' }).success).toBe(false);
  });
});
