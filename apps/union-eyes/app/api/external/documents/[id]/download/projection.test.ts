import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('external document download projection', () => {
  it('does not return the stored file address when a version key is missing', () => {
    const source = readFileSync(join(__dirname, 'route.ts'), 'utf8');
    expect(source).toContain('generateSasUrl');
    expect(source).not.toContain('fileUrl');
    expect(source).toContain('Download is not available');
  });

  it('detail responses select metadata without a storage address', () => {
    const source = readFileSync(join(__dirname, '../route.ts'), 'utf8');
    expect(source).not.toContain('fileUrl');
    expect(source).not.toContain('contentText');
    expect(source).toContain('privacyLabel');
  });
});
