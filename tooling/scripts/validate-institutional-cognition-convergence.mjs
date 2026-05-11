#!/usr/bin/env node

/**
 * Nzila OS — Institutional Cognition Convergence Validator
 *
 * Enforces the canonical cognition doctrine across the repo:
 *  - all required doctrine docs exist
 *  - prohibited AI/surveillance/optimization framing is absent on live surfaces
 *  - bounded interpretation, escalation, and continuity-safe posture are present
 *  - cross-app cognition consistency invariants hold
 *
 * Doctrine anchor: docs/nzila-cognition-doctrine/institutional-operational-cognition-doctrine.md
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const doctrineRoot = path.join(repoRoot, 'docs', 'nzila-cognition-doctrine');

const requiredDocs = [
  'README.md',
  'institutional-operational-cognition-doctrine.md',
  'repo-wide-intelligence-audit.md',
  'ue-intelligence-realignment.md',
  'executiveos-cognition-realignment.md',
  'faircase-governance-realignment.md',
  'platform-cognition-substrate-refactor.md',
  'cfo-cognition-realignment.md',
  'knowledge-memory-infrastructure-refactor.md',
  'global-ux-cognition-refactor.md',
  'global-anti-surveillance-enforcement.md',
  'cross-app-cognition-consistency.md',
  'procurement-governance-positioning-refactor.md',
  'final-cognition-convergence-readiness-review.md',
];

// Live user-facing cognition surfaces governed by the doctrine.
const liveSurfaceFiles = [
  // CFO converged surfaces
  path.join(repoRoot, 'apps', 'cfo', 'app', '[locale]', 'dashboard', 'advisory-ai', 'page.tsx'),
  path.join(repoRoot, 'apps', 'cfo', 'app', '[locale]', 'dashboard', 'ai-insights', 'page.tsx'),
  // Console converged surface
  path.join(repoRoot, 'apps', 'console', 'app', '(dashboard)', 'weekly-review', 'weekly-review-client.tsx'),
  // UE converged labor continuity surfaces (already converged in prior phase, re-checked here for cross-app consistency)
  path.join(repoRoot, 'apps', 'union-eyes', 'app', '[locale]', 'dashboard', 'cba-intelligence', 'cba-intelligence-client.tsx'),
  path.join(repoRoot, 'apps', 'union-eyes', 'components', 'grievances', 'case-intelligence-panel.tsx'),
];

// Globally prohibited framing on live user-facing surfaces.
// Doctrine reference: institutional-operational-cognition-doctrine.md §3, global-anti-surveillance-enforcement.md.
const prohibitedPatterns = [
  { label: 'AI assistant framing', re: /\bai\s+assistant\b/gi },
  { label: 'AI-powered framing', re: /\bai[-\s]powered\b/gi },
  { label: 'AI-first framing', re: /\bai[-\s]first\b/gi },
  { label: 'autonomous intelligence framing', re: /\bautonomous\s+intelligence\b/gi },
  { label: 'autonomous executive framing', re: /\bautonomous\s+executive\b/gi },
  { label: 'AI CEO framing', re: /\bai\s+ceo\b/gi },
  { label: 'AI CFO framing', re: /\bai\s+cfo\b/gi },
  { label: 'chatbot primacy framing', re: /\bask\s+anything\b/gi },
  { label: 'employee scoring framing', re: /\bemployee\s+scoring\b/gi },
  { label: 'productivity ranking framing', re: /\bproductivity\s+ranking\b/gi },
  { label: 'workforce surveillance framing', re: /\bworkforce\s+surveillance\b/gi },
  { label: 'behavioral ranking framing', re: /\bbehavioral\s+ranking\b/gi },
  { label: 'engagement optimization framing', re: /\bengagement\s+optimization\b/gi },
];

// Recognized in-line prohibition contexts (a hit inside such context is intentional doctrinal language, not drift).
const prohibitionContextSignals = [
  'prohibit',
  'prohibited',
  'forbidden',
  'must not',
  'never',
  'avoid',
  'reject',
  'disallow',
  'disallowed',
  'explicitly',
  'doctrine',
  'doctrinal',
];

// Required terminology that must appear in the doctrine docs.
const requiredDoctrineTerminology = [
  'governance-safe institutional operational cognition',
  'bounded institutional interpretation',
  'continuity-safe',
  'institutional memory',
  'escalation',
  'human reviewer of record',
  'final authority remains',
  'anti-surveillance',
  'cognition substrate',
  'stewardship',
  'executive cognition',
];

// Anti-surveillance affirmation signals expected in doctrine.
const antiSurveillanceSignals = [
  'no employee scoring',
  'no behavioral ranking',
  'no productivity surveillance',
  'no individual-employee surveillance',
  'employee scoring',
  'behavioral ranking',
];

// Bounded interpretation signals expected in docs OR live surfaces.
const boundedInterpretationSignals = [
  'interpretive support only',
  'bounded institutional interpretation',
  'final authority remains',
  'human reviewer of record',
  'non-authoritative',
];

// Escalation / human-authority signals expected on live surfaces.
const escalationSignals = [
  'escalat',
  'human review',
  'final authority remains',
  'accountable human operators',
  'accountable financial operators',
  'human authority',
  'human investigator',
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

function rel(p) {
  return path.relative(repoRoot, p).replaceAll('\\', '/');
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
    const mid = (low + high) >> 1;
    if (lineStarts[mid] <= offset) {
      if (mid === lineStarts.length - 1 || lineStarts[mid + 1] > offset) return mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return 0;
}

async function main() {
  const errors = [];

  // ── 1. Required doctrine docs exist ──────────────────────────────
  const docPaths = [];
  const missingDocs = [];
  for (const name of requiredDocs) {
    const full = path.join(doctrineRoot, name);
    if (!(await exists(full))) {
      missingDocs.push(rel(full));
      continue;
    }
    docPaths.push(full);
  }
  if (missingDocs.length > 0) {
    errors.push(`Missing required cognition doctrine docs:\n- ${missingDocs.join('\n- ')}`);
  }

  // ── 2. Live surfaces exist ───────────────────────────────────────
  const existingLive = [];
  const missingLive = [];
  for (const filePath of liveSurfaceFiles) {
    if (!(await exists(filePath))) {
      missingLive.push(rel(filePath));
      continue;
    }
    existingLive.push(filePath);
  }
  if (missingLive.length > 0) {
    errors.push(`Missing expected live cognition surface files:\n- ${missingLive.join('\n- ')}`);
  }

  // ── 3. Prohibited semantics absent on live surfaces ──────────────
  const prohibitedHits = [];
  for (const filePath of existingLive) {
    const text = await readText(filePath);
    const lower = text.toLowerCase();
    const lines = lower.split('\n');
    const lineStarts = buildLineStarts(lower);

    for (const pattern of prohibitedPatterns) {
      const hits = [];
      for (const match of lower.matchAll(pattern.re)) {
        const idx = match.index ?? 0;
        const start = Math.max(0, idx - 140);
        const end = Math.min(lower.length, idx + (match[0]?.length ?? 0) + 140);
        const context = lower.slice(start, end);
        const lineIndex = getLineIndexAtOffset(lineStarts, idx);
        const nearby = lines.slice(Math.max(0, lineIndex - 4), Math.min(lines.length, lineIndex + 2)).join('\n');
        const inProhibitionContext = prohibitionContextSignals.some((s) => context.includes(s) || nearby.includes(s));
        if (!inProhibitionContext) hits.push(match[0]);
      }
      if (hits.length > 0) prohibitedHits.push(`${rel(filePath)} -> ${pattern.label} (${hits.length})`);
    }
  }
  if (prohibitedHits.length > 0) {
    errors.push(`Prohibited cognition framing detected on live surfaces:\n- ${prohibitedHits.join('\n- ')}`);
  }

  // ── 4. Required doctrine terminology present ─────────────────────
  const docsTextLower = (await Promise.all(docPaths.map(readText))).join('\n\n').toLowerCase();
  const missingTerminology = requiredDoctrineTerminology.filter((t) => !docsTextLower.includes(t.toLowerCase()));
  if (missingTerminology.length > 0) {
    errors.push(`Required cognition doctrine terminology missing:\n- ${missingTerminology.join('\n- ')}`);
  }

  // ── 5. Anti-surveillance posture present in doctrine ─────────────
  const antiSurveillanceFound = antiSurveillanceSignals.filter((s) => docsTextLower.includes(s));
  if (antiSurveillanceFound.length === 0) {
    errors.push('Anti-surveillance posture not detected in doctrine documents.');
  }

  // ── 6. Bounded interpretation enforcement adequately distributed ─
  const liveTexts = await Promise.all(existingLive.map(readText));
  const liveJoinedLower = liveTexts.join('\n\n').toLowerCase();
  const boundedFound = boundedInterpretationSignals.filter((s) => docsTextLower.includes(s) || liveJoinedLower.includes(s));
  if (boundedFound.length < 3) {
    errors.push('Bounded interpretation enforcement is weak (need ≥ 3 distinct bounded signals across docs + live surfaces).');
  }

  // ── 7. Continuity embedding on live surfaces ─────────────────────
  const continuityCount = liveTexts.filter((t) => t.toLowerCase().includes('continuity')).length;
  if (continuityCount < Math.max(3, Math.ceil(existingLive.length * 0.6))) {
    errors.push(
      `Continuity-safe operational embedding is incomplete (${continuityCount}/${existingLive.length} live surfaces mention continuity).`,
    );
  }

  // ── 8. Escalation / human-authority cues on live surfaces ────────
  const escalationCount = liveTexts.filter((t) => {
    const lower = t.toLowerCase();
    return escalationSignals.some((s) => lower.includes(s));
  }).length;
  if (escalationCount < Math.max(3, Math.ceil(existingLive.length * 0.6))) {
    errors.push(
      `Escalation / human-authority embedding is insufficient (${escalationCount}/${existingLive.length} live surfaces include escalation cues).`,
    );
  }

  // ── 9. Cross-app cognition consistency anchor exists ─────────────
  const crossAppDoc = path.join(doctrineRoot, 'cross-app-cognition-consistency.md');
  if (await exists(crossAppDoc)) {
    const txt = (await readText(crossAppDoc)).toLowerCase();
    const requiredAnchors = ['ue', 'console', 'executiveos', 'faircase', 'cfo', 'platform'];
    const missingAnchors = requiredAnchors.filter((a) => !txt.includes(a));
    if (missingAnchors.length > 0) {
      errors.push(`Cross-app cognition consistency anchors missing in doctrine: ${missingAnchors.join(', ')}.`);
    }
  }

  if (errors.length > 0) {
    console.error('\nInstitutional cognition convergence validation FAILED.\n');
    for (const err of errors) console.error(`- ${err}\n`);
    process.exit(1);
  }

  console.log('Institutional cognition convergence validation passed.');
  console.log(`Validated doctrine docs: ${docPaths.length}`);
  console.log(`Validated live cognition surfaces: ${existingLive.length}`);
}

main().catch((error) => {
  console.error('Cognition convergence validator crashed:', error);
  process.exit(1);
});
