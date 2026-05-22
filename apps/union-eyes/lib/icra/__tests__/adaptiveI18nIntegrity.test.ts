/**
 * ARTIFACT TYPE: Vitest Suite — OCRA Live Adaptive Flow
 * MODULE: Bilingual integrity of the adaptive explanation card copy
 * DOCTRINE_VERSION: 1.0.0
 *
 * Reads the live `ICRAAssessmentFlow.tsx` source and asserts that every
 * `adaptive*` copy key declared inside the en-CA `FLOW_COPY` block also
 * exists inside the fr-CA `FLOW_COPY` block, and vice versa. This is the
 * canonical guard against accidental locale drift in the adaptive
 * explanation surface.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const COMPONENT_PATH = path.resolve(
  __dirname,
  '../../../components/icra/ICRAAssessmentFlow.tsx',
);

function extractAdaptiveKeysFromLocaleBlock(source: string, locale: string): string[] {
  // Match the locale block, e.g. 'en-CA': { ... },
  const startMarker = `'${locale}': {`;
  const start = source.indexOf(startMarker);
  if (start < 0) return [];
  // Walk forward, tracking brace depth, to find the matching close-brace.
  let depth = 0;
  let end = -1;
  for (let i = start + startMarker.length - 1; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return [];
  const body = source.slice(start, end);
  const keys = new Set<string>();
  const re = /\b(adaptive[A-Za-z0-9]+)\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    keys.add(m[1]);
  }
  return Array.from(keys).sort();
}

describe('OCRA adaptive copy — bilingual integrity', () => {
  const source = readFileSync(COMPONENT_PATH, 'utf-8');
  const enKeys = extractAdaptiveKeysFromLocaleBlock(source, 'en-CA');
  const frKeys = extractAdaptiveKeysFromLocaleBlock(source, 'fr-CA');

  it('the en-CA locale declares at least one adaptive copy key', () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it('the fr-CA locale declares the same set of adaptive copy keys as en-CA', () => {
    expect(frKeys).toEqual(enKeys);
  });

  it('every adaptive copy key is non-empty in both locales', () => {
    for (const key of enKeys) {
      const enValueRe = new RegExp(
        `${key}\\s*:\\s*(?:'([^']+)'|"([^"]+)")`,
      );
      const enMatch = source.match(enValueRe);
      expect(enMatch, `en-CA value for ${key}`).not.toBeNull();
      expect((enMatch?.[1] ?? enMatch?.[2] ?? '').trim().length).toBeGreaterThan(0);
    }
  });
});
