import fs from 'node:fs';
import nodePath from 'node:path';

import 'server-only';

const WHITEPAPER_DOCS_ROOT_ENV = 'WHITEPAPER_DOCS_ROOT';

function getWhitepaperDocsRootCandidates(): string[] {
  const configuredRoot = process.env[WHITEPAPER_DOCS_ROOT_ENV]?.trim();
  const cwdCandidates: string[] = [];

  for (let levelsUp = 0; levelsUp <= 5; levelsUp += 1) {
    const segments = levelsUp === 0 ? [] : new Array(levelsUp).fill('..');
    cwdCandidates.push(nodePath.resolve(process.cwd(), ...segments, 'docs', 'oci', 'whitepapers'));
  }

  return Array.from(new Set([
    configuredRoot,
    ...cwdCandidates,
  ].filter((candidate): candidate is string => Boolean(candidate))));
}

export function resolveRuntimeWhitepaperSourcePath(sourceFile: string): string {
  const candidates = getWhitepaperDocsRootCandidates();

  for (const docsRoot of candidates) {
    const candidatePath = nodePath.join(docsRoot, sourceFile);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  const fallbackRoot = candidates[0] ?? nodePath.resolve(process.cwd(), 'docs', 'oci', 'whitepapers');
  return nodePath.join(fallbackRoot, sourceFile);
}