import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// DEF-0B5-COGNITION-SNAPSHOTS-IN-LOCAL-FILES and DEF-0B5-COGNITION-READ-ROUTES-WRITE-FILES: cognition read routes wrote snapshots to local files, which
// is neither durable nor tenant-safe and was audited apart from the read. Route handlers and the cognition libraries keep nothing on the local file
// system. (A read-only stat of a generated export is the one allowed use and is named.)
const ROOT = path.resolve(__dirname, '../../..');
const TARGETS = ['app/api', 'lib/knowledge-transfer', 'lib/organizational-operating-intelligence', 'lib/cognition'];
const ALLOWED_READ_ONLY = new Set(['app/api/gdpr/data-export/route.ts']);

function sources(dir: string, out: string[] = []): string[] {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') sources(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

describe('route and cognition code keeps nothing on the local file system', () => {
  const files = TARGETS.flatMap((t) => sources(path.join(ROOT, t)));

  it('finds the sources it is checking', () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it('none writes a file', () => {
    const offenders = files
      .filter((file) => !ALLOWED_READ_ONLY.has(path.relative(ROOT, file).split(path.sep).join('/')))
      .filter((file) => /\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|mkdirSync|mkdir)\s*\(/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
