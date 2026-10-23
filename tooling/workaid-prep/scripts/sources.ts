import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
export const workaidDocs = join(repoRoot, 'docs', 'union-eyes', 'workaid');
export const baselineDir = join(workaidDocs, 'baseline-pack-v0.1');
export const grokDir = join(workaidDocs, 'grok-redteam-01');

export type Severity = 'P0' | 'P1' | 'P2' | 'P3';
export type SourceRound = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'INT';

export interface SourceFinding {
  readonly id: string;
  readonly round: SourceRound;
  readonly sourceSeverity: string;
  readonly severity: Severity;
  readonly title: string;
  readonly sourceDisposition: string;
  readonly sourceFile: string;
}

const SEVERITY: Record<string, Severity> = { CRITICAL: 'P0', HIGH: 'P1', MEDIUM: 'P2', LOW: 'P3', P0: 'P0', P1: 'P1', P2: 'P2', P3: 'P3' };

export const read = (path: string) => readFileSync(path, 'utf8');
export const sha256 = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex');

const clean = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const short = (s: string, n = 140) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

function tableRows(text: string, idPrefix: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.startsWith(`| ${idPrefix}`))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

export function parseR1(): SourceFinding[] {
  const file = join(baselineDir, 'WORKAID_ADVERSARIAL_REVIEW_R1.md');
  return tableRows(read(file), 'WA-R1-').map((c) => ({
    id: c[0]!,
    round: 'R1',
    sourceSeverity: c[1]!,
    severity: SEVERITY[c[1]!]!,
    title: short(clean(/^\*\*([^*]+)\*\*/.exec(c[2]!)?.[1] ?? c[2]!)),
    sourceDisposition: 'OPEN_FOR_EXECUTABLE_PROOF',
    sourceFile: 'baseline-pack-v0.1/WORKAID_ADVERSARIAL_REVIEW_R1.md',
  }));
}

export function parseR2(): SourceFinding[] {
  const file = join(baselineDir, 'WORKAID_ADVERSARIAL_REVIEW_R2.md');
  return tableRows(read(file), 'WA-R2-').map((c) => ({
    id: c[0]!,
    round: 'R2',
    sourceSeverity: c[1]!,
    severity: SEVERITY[c[1]!]!,
    title: short(clean(c[2]!.split(/\. |: /)[0] ?? c[2]!)),
    sourceDisposition: 'OPEN_FOR_EXECUTABLE_PROOF',
    sourceFile: 'baseline-pack-v0.1/WORKAID_ADVERSARIAL_REVIEW_R2.md',
  }));
}

export function parseR3(): SourceFinding[] {
  const file = join(grokDir, 'WA_GROK_R3_ADVERSARIAL_FINDINGS.md');
  const parts = read(file).split(/^### (?=WA-R3-)/m).slice(1);
  return parts.map((p) => {
    const head = /^(WA-R3-\d{3}) · (.+?) · Severity \*\*(P\d)\*\*/.exec(p)!;
    const obs = /\*\*Observed[^:]*:\*\*\s*(.+)/.exec(p)?.[1] ?? '';
    const disp = /\*\*Disposition:\*\*\s*\*\*([A-Z_]+)\*\*/.exec(p)?.[1] ?? 'OPEN';
    return {
      id: head[1]!,
      round: 'R3' as const,
      sourceSeverity: head[3]!,
      severity: SEVERITY[head[3]!]!,
      title: short(clean(obs.split(/\. |\.\s*$/)[0] ?? obs)),
      sourceDisposition: disp,
      sourceFile: 'grok-redteam-01/WA_GROK_R3_ADVERSARIAL_FINDINGS.md',
    };
  });
}

export function parseExtension(): SourceFinding[] {
  const file = join(grokDir, 'WA_GROK_REVIEW_EXTENSION.md');
  const text = read(file);
  const out: SourceFinding[] = [];
  for (const round of ['R4', 'R5', 'R6'] as const) {
    for (const c of tableRows(text, `WA-${round}-`)) {
      out.push({
        id: c[0]!,
        round,
        sourceSeverity: c[1]!,
        severity: SEVERITY[c[1]!]!,
        title: short(clean(c[2]!)),
        sourceDisposition: 'OPEN_FOR_EXECUTABLE_PROOF',
        sourceFile: 'grok-redteam-01/WA_GROK_REVIEW_EXTENSION.md',
      });
    }
  }
  return out;
}

/** Independent hypotheses from the triage. Each was checked against the pinned source in test/platform-repro.test.ts. */
export const INTAKE_HYPOTHESES: SourceFinding[] = [
  {
    id: 'WA-INT-001',
    round: 'INT',
    sourceSeverity: 'P1 (triage)',
    severity: 'P1',
    title: 'Blob object key embeds the human document name and the name is logged',
    sourceDisposition: 'HYPOTHESIS',
    sourceFile: 'grok-redteam-01/WorkAid_Grok_R3-R6_Triage_2026-10-23.md',
  },
  {
    id: 'WA-INT-002',
    round: 'INT',
    sourceSeverity: 'P1 (triage)',
    severity: 'P1',
    title: 'Azure branch claims a 1-year SAS URL but returns an unsigned container URL',
    sourceDisposition: 'HYPOTHESIS',
    sourceFile: 'grok-redteam-01/WorkAid_Grok_R3-R6_Triage_2026-10-23.md',
  },
  {
    id: 'WA-INT-003',
    round: 'INT',
    sourceSeverity: 'P1 (triage)',
    severity: 'P1',
    title: 'S3/R2 upload stores the object before signing; a signing failure orphans it',
    sourceDisposition: 'HYPOTHESIS',
    sourceFile: 'grok-redteam-01/WorkAid_Grok_R3-R6_Triage_2026-10-23.md',
  },
];

export function allSourceFindings(): SourceFinding[] {
  return [...parseR1(), ...parseR2(), ...parseR3(), ...parseExtension(), ...INTAKE_HYPOTHESES];
}

/* ---------------- acceptance matrix ---------------- */

export interface MatrixRow {
  readonly id: string;
  readonly domain: string;
  readonly severity: string;
  readonly actor: string;
  readonly stimulus: string;
  readonly expected: string;
  readonly assertion: string;
  readonly owner: string;
  readonly priorState: string;
  readonly relatedFindings: string;
  readonly origin: 'PACK_V0_1' | 'GROK_DELTA';
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.length > 0));
}

export function parsePackMatrix(): MatrixRow[] {
  const [, ...rows] = parseCsv(read(join(baselineDir, 'WORKAID_ACCEPTANCE_MATRIX.csv')));
  return rows.map((c) => ({
    id: c[0]!,
    domain: c[1]!,
    severity: c[2]!,
    actor: c[3]!,
    stimulus: c[4]!,
    expected: c[5]!,
    assertion: c[6]!,
    owner: c[7]!,
    priorState: c[8]!,
    relatedFindings: '',
    origin: 'PACK_V0_1' as const,
  }));
}

export function parseGrokDelta(): MatrixRow[] {
  const [, ...rows] = parseCsv(read(join(grokDir, 'WA_GROK_ACCEPTANCE_DELTA.csv')));
  return rows.map((c) => ({
    id: c[0]!,
    domain: 'Platform / Grok R3',
    severity: c[1]!,
    actor: 'See scenario',
    stimulus: c[2]!,
    expected: c[3]!,
    assertion: c[4]!,
    owner: c[5]!,
    priorState: c[6]!,
    relatedFindings: c[7]!.replace(/;/g, ' '),
    origin: 'GROK_DELTA' as const,
  }));
}
