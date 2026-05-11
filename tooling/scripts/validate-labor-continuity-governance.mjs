#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const docsRoot = path.join(repoRoot, 'docs', 'union-eyes', 'labor-continuity-intelligence');

const requiredDocs = [
  'institutional-labor-continuity-framework.md',
  'stewardship-continuity-architecture.md',
  'governance-safe-labor-intelligence-model.md',
  'operational-embedding-refactor.md',
  'grievance-continuity-intelligence.md',
  'onboarding-continuity-intelligence.md',
  'executive-labor-continuity-briefings.md',
  'labor-continuity-ux-refactor.md',
  'procurement-positioning-refactor.md',
  'cross-app-continuity-intelligence-consistency.md',
  'final-labor-continuity-readiness-review.md',
];

const liveSurfaceFiles = [
  path.join(repoRoot, 'apps', 'union-eyes', 'app', '[locale]', 'dashboard', 'cba-intelligence', 'cba-intelligence-client.tsx'),
  path.join(repoRoot, 'apps', 'union-eyes', 'components', 'grievances', 'case-intelligence-panel.tsx'),
  path.join(repoRoot, 'apps', 'union-eyes', 'components', 'onboarding', 'steward-onboarding-wizard.tsx'),
  path.join(repoRoot, 'apps', 'union-eyes', 'components', 'onboarding', 'officer-onboarding-wizard.tsx'),
  path.join(repoRoot, 'apps', 'union-eyes', 'app', '[locale]', 'dashboard', 'executive-operating-intelligence', 'page.tsx'),
  path.join(repoRoot, 'apps', 'console', 'app', '(dashboard)', 'weekly-review', 'weekly-review-client.tsx'),
];

const prohibitedPatterns = [
  { label: 'AI assistant framing', re: /\bai assistant\b/gi },
  { label: 'CBA chatbot framing', re: /\bcba chatbot\b/gi },
  { label: 'labor GPT framing', re: /\blabor\s+gpt\b/gi },
  { label: 'ask anything framing', re: /\bask\s+anything\b/gi },
  { label: 'automated labor analysis framing', re: /\bautomated\s+labor\s+analysis\b/gi },
  { label: 'authoritative AI interpretation framing', re: /\bai\s+interpretation\b/gi },
  { label: 'autonomous labor governance framing', re: /\bautonomous\s+labor\s+governance\b/gi },
  { label: 'worker surveillance framing', re: /\bworkforce\s+surveillance\b/gi },
  { label: 'employee scoring framing', re: /\bemployee\s+scoring\b/gi },
  { label: 'steward scoring framing', re: /\bsteward\s+scoring\b/gi },
  { label: 'productivity ranking framing', re: /\bproductivity\s+ranking\b/gi },
];

const prohibitionContextSignals = [
  'prohibit',
  'prohibited',
  'forbidden',
  'must not',
  'not allowed',
  'avoid',
  'reject',
  'rejection',
  'disallowed',
  'explicitly',
];

const requiredTerminologyChecks = [
  'institutional labor continuity intelligence',
  'governance-safe',
  'stewardship continuity',
  'institutional memory',
  'bounded',
  'escalation',
  'continuity',
];

const antiSurveillanceSignals = [
  'anti-surveillance',
  'no individual employee scoring',
  'no individual productivity',
  'no steward scoring',
];

const boundedInterpretationSignals = [
  'interpretive support only',
  'non-authoritative',
  'final authority remains',
  'does not issue authoritative labor rulings',
  'human review',
];

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function countOccurrences(text, needle) {
  const src = text.toLowerCase();
  const token = needle.toLowerCase();
  let idx = 0;
  let count = 0;
  while ((idx = src.indexOf(token, idx)) !== -1) {
    count += 1;
    idx += token.length;
  }
  return count;
}

function buildLineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function getLineIndexAtOffset(lineStarts, offset) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= offset) {
      if (mid === lineStarts.length - 1 || lineStarts[mid + 1] > offset) return mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return 0;
}

function rel(p) {
  return path.relative(repoRoot, p).replaceAll('\\', '/');
}

async function main() {
  const errors = [];

  const missingDocs = [];
  const docPaths = [];
  for (const name of requiredDocs) {
    const full = path.join(docsRoot, name);
    if (!(await exists(full))) {
      missingDocs.push(rel(full));
      continue;
    }
    docPaths.push(full);
  }

  if (missingDocs.length > 0) {
    errors.push(`Missing required authority docs:\n- ${missingDocs.join('\n- ')}`);
  }

  const missingLive = [];
  const existingLive = [];
  for (const filePath of liveSurfaceFiles) {
    if (!(await exists(filePath))) {
      missingLive.push(rel(filePath));
      continue;
    }
    existingLive.push(filePath);
  }

  if (missingLive.length > 0) {
    errors.push(`Missing expected live surface files:\n- ${missingLive.join('\n- ')}`);
  }

  const docsText = (await Promise.all(docPaths.map(readText))).join('\n\n').toLowerCase();
  const liveTexts = await Promise.all(existingLive.map(readText));
  const liveJoined = liveTexts.join('\n\n').toLowerCase();

  const prohibitedHits = [];
  for (const filePath of existingLive) {
    const text = (await readText(filePath)).toLowerCase();
    const lines = text.split('\n');
    const lineStarts = buildLineStarts(text);
    for (const pattern of prohibitedPatterns) {
      const hits = [];
      for (const match of text.matchAll(pattern.re)) {
        const start = Math.max(0, (match.index ?? 0) - 120);
        const end = Math.min(text.length, (match.index ?? 0) + (match[0]?.length ?? 0) + 120);
        const context = text.slice(start, end);
        const lineIndex = getLineIndexAtOffset(lineStarts, match.index ?? 0);
        const nearbyLines = lines.slice(Math.max(0, lineIndex - 4), Math.min(lines.length, lineIndex + 2)).join('\n');
        const isInProhibitionContext = prohibitionContextSignals.some(
          (signal) => context.includes(signal) || nearbyLines.includes(signal),
        );
        if (!isInProhibitionContext) {
          hits.push(match[0]);
        }
      }
      if (hits.length > 0) {
        prohibitedHits.push(`${rel(filePath)} -> ${pattern.label} (${hits.length})`);
      }
    }
  }

  if (prohibitedHits.length > 0) {
    errors.push(`Prohibited language detected:\n- ${prohibitedHits.join('\n- ')}`);
  }

  const missingTerminology = requiredTerminologyChecks.filter((term) => countOccurrences(docsText, term) === 0);
  if (missingTerminology.length > 0) {
    errors.push(`Required governance-safe terminology missing from authority docs:\n- ${missingTerminology.join('\n- ')}`);
  }

  const antiSignalsFound = antiSurveillanceSignals.filter((term) => docsText.includes(term));
  if (antiSignalsFound.length === 0) {
    errors.push('Anti-surveillance posture not detected in authority docs.');
  }

  const boundedSignalsFound = boundedInterpretationSignals.filter((term) => docsText.includes(term) || liveJoined.includes(term));
  if (boundedSignalsFound.length < 3) {
    errors.push('Bounded interpretation enforcement appears weak (expected at least 3 distinct bounded signals).');
  }

  const liveContinuityCount = existingLive.filter((_, i) => {
    const t = liveTexts[i].toLowerCase();
    return t.includes('continuity');
  }).length;
  if (liveContinuityCount < 4) {
    errors.push(`Continuity-safe operational embedding is incomplete (${liveContinuityCount}/${existingLive.length} files mention continuity).`);
  }

  const liveEscalationCount = existingLive.filter((_, i) => {
    const t = liveTexts[i].toLowerCase();
    return t.includes('escalat') || t.includes('human review') || t.includes('final authority remains');
  }).length;
  if (liveEscalationCount < 3) {
    errors.push(`Escalation pathway presence is insufficient (${liveEscalationCount}/${existingLive.length} files include escalation/human review cues).`);
  }

  if (errors.length > 0) {
    console.error('\nLabor continuity governance validation failed.\n');
    for (const err of errors) {
      console.error(`- ${err}\n`);
    }
    process.exit(1);
  }

  console.log('Labor continuity governance validation passed.');
  console.log(`Validated docs: ${docPaths.length}`);
  console.log(`Validated live surfaces: ${existingLive.length}`);
}

main().catch((error) => {
  console.error('Validator crashed:', error);
  process.exit(1);
});
