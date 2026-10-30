import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Contract test: no provider invocation when the source has revoked consent.
// Full live signed-in and real-provider validation remains separately required.
describe('exit interview summarization consent floor', () => {
  it('refuses publication-revoked interviews before the AI operation is launched', () => {
    const path = resolve(__dirname, '../exit-interviews/[id]/summarize/route.ts');
    const src = readFileSync(path, 'utf8');
    const floor = src.indexOf("if (interview.consentGranted !== true)");
    const providerCall = src.indexOf("summary = await performAuditedOperation(");
    expect(floor).toBeGreaterThan(-1);
    expect(providerCall).toBeGreaterThan(floor);
    expect(src).toContain("throw ApiError.conflict('Retiree consent has not been granted or has been withdrawn')");
  });
});
