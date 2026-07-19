import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { existsSync } = vi.hoisted(() => ({ existsSync: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('node:fs', () => ({ default: { existsSync }, existsSync }));

import { resolveRuntimeWhitepaperSourcePath } from '../source-path';

describe('lib/whitepaper/source-path', () => {
  const originalEnv = process.env.WHITEPAPER_DOCS_ROOT;

  beforeEach(() => {
    existsSync.mockReset();
    delete process.env.WHITEPAPER_DOCS_ROOT;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.WHITEPAPER_DOCS_ROOT;
    else process.env.WHITEPAPER_DOCS_ROOT = originalEnv;
  });

  it('returns the first candidate path that exists on disk', () => {
    existsSync.mockReturnValue(true);
    const result = resolveRuntimeWhitepaperSourcePath('paper.pdf');
    expect(result.endsWith('paper.pdf')).toBe(true);
    expect(existsSync).toHaveBeenCalled();
  });

  it('falls back to the first candidate root when nothing exists', () => {
    existsSync.mockReturnValue(false);
    const result = resolveRuntimeWhitepaperSourcePath('missing.pdf');
    expect(result.endsWith('missing.pdf')).toBe(true);
    expect(result).toContain('docs');
  });

  it('prefers a configured docs root from the environment', () => {
    process.env.WHITEPAPER_DOCS_ROOT = '/custom/root';
    existsSync.mockReturnValue(false);
    const result = resolveRuntimeWhitepaperSourcePath('p.pdf');
    // Use path.join so the expected value is native to the current platform
    // (Windows produces "\custom\root\p.pdf" from path.join under the source's
    // path.join call, so we compare via path.join here too).
    expect(result).toBe(path.join('/custom/root', 'p.pdf'));
  });
});
