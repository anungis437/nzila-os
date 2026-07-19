import nodePath from 'node:path';

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
    // Use nodePath.join so the expected value uses the host-platform separator
    // (path.join produces '\\' on Windows, '/' on POSIX).
    expect(result).toBe(nodePath.join('/custom/root', 'p.pdf'));
  });
});
