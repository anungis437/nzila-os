/**
 * Builds the revised baseline artifacts from (a) the parsed source documents,
 * (b) the hand-authored triage overlay and (c) the executed test results.
 *
 * Usage (from tooling/workaid-prep):
 *   node scripts/run-tests.ts && node scripts/build-baseline.ts
 *
 * The build fails if an overlay cites a test tag with no passing test, or if
 * any source finding lacks a triage overlay. FIXED_PROVEN is never emitted.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADVERSARIAL_CASES, OVERLAY } from './triage-overlay.ts';
import { REQUIREMENTS } from './requirements.ts';
import type { Route } from './triage-overlay.ts';
import { allSourceFindings, parseGrokDelta, parsePackMatrix, workaidDocs } from './sources.ts';
import type { MatrixRow } from './sources.ts';

interface Case {
  file: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
}
interface Results {
  command: string;
  node: string;
  baseCommit: string;
  workingTreeDirty: boolean;
  totals: { total: number; pass: number; fail: number; skipped: number };
  cases: Case[];
}

const results = JSON.parse(readFileSync(join(workaidDocs, 'evidence', 'test-results.json'), 'utf8')) as Results;

/* ---------------- tag index ---------------- */
interface TagInfo {
  pass: number;
  fail: number;
  files: Set<string>;
  names: string[];
}
const tags = new Map<string, TagInfo>();
for (const c of results.cases) {
  for (const m of c.name.matchAll(/\[(WA-(?:T\d{3}|ADV-\d{2}|INT-\d{3}))\]/g)) {
    const t = tags.get(m[1]!) ?? { pass: 0, fail: 0, files: new Set(), names: [] };
    if (c.status === 'PASS') t.pass++;
    else if (c.status === 'FAIL') t.fail++;
    t.files.add(c.file);
    t.names.push(c.name);
    tags.set(m[1]!, t);
  }
}
const full = (short: string) => (short.startsWith('WA-') ? short : `WA-${short}`);
const tagStatus = (id: string): 'PASS' | 'FAIL' | 'NONE' => {
  const t = tags.get(id);
  return !t ? 'NONE' : t.fail > 0 ? 'FAIL' : 'PASS';
};

/* ---------------- acceptance matrix v0.2 ---------------- */
const BLOCKED: Record<string, string> = {
  'WA-T022': 'Needs a running worker with orphaned organization context.',
  'WA-T057': 'Needs database and object-store failure injection against the real service.',
  'WA-T059': 'Needs an application restart against a durable outbox.',
  'WA-T060': 'Needs a built UI for interaction counting.',
  'WA-T061': 'Needs a built oversight view and real aggregates.',
  'WA-T062': 'Needs a measured pilot cohort.',
  'WA-T063': 'Needs built member flows and assistive-technology testing.',
  'WA-T064': 'Needs built member flows on small screens.',
  'WA-T065': 'Needs approved plain-language content and a built UI.',
  'WA-T067': 'Retention policy is a legal and privacy decision; no store to execute against.',
  'WA-T068': 'Needs deployed sessions, thumbnails, reports and exports.',
  'WA-T069': 'Needs deployed multi-institution identity.',
  'WA-T070': 'Needs a built confirmation UI.',
  'WA-T087': 'Release gate owned by Codex; requires attested runtime evidence.',
  'WA-T088': 'Platform action with mocked unit tests only; runtime proof owned by Codex.',
  'WA-T089': 'Needs deployed multi-organization specialist sessions.',
  'WA-T093': 'Platform AI path; owned by Codex.',
};

const rows: MatrixRow[] = [...parsePackMatrix(), ...parseGrokDelta()];
const matrixOut = rows.map((r) => {
  const t = tags.get(r.id);
  const status = t ? (t.fail > 0 ? 'EXECUTED_SYNTHETIC_FAIL' : 'EXECUTED_SYNTHETIC_PASS') : BLOCKED[r.id] ? 'BLOCKED_RUNTIME_OR_EXTERNAL' : 'DESIGNED_NOT_EXECUTED';
  const onlyRepro = !!t && [...t.files].every((f) => f.endsWith('platform-repro.test.ts'));
  const proof = !t ? 'NONE' : onlyRepro ? 'SYNTHETIC_REPRO_OF_PLATFORM_DEFECT' : 'SYNTHETIC_CONTRACT';
  return {
    ...r,
    status,
    proof,
    evidence: t ? t.names.map((n) => `${[...t.files][0]!.replace('test/', '')}: ${n}`).join(' || ') : '',
    note: BLOCKED[r.id] ?? '',
  };
});
const countBy = <T>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((a, x) => ((a[f(x)] = (a[f(x)] ?? 0) + 1), a), {});
const matrixCounts = countBy(matrixOut, (r) => r.status);

const csvCell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const csvHead = ['ID', 'Origin', 'Domain', 'Severity', 'Actor', 'Stimulus', 'Expected_behavior', 'Negative_or_adversarial_assertion', 'Owner', 'State_v0_2', 'Prior_state', 'Proof_level', 'Runtime_gate', 'Related_findings', 'Evidence', 'Blocked_reason'];
const csv = [csvHead.join(',')]
  .concat(
    matrixOut.map((r) =>
      [r.id, r.origin, r.domain, r.severity, r.actor, r.stimulus, r.expected, r.assertion, r.owner, r.status, r.priorState, r.proof, 'NOT_CLOSED', r.relatedFindings, r.evidence, r.note].map(csvCell).join(','),
    ),
  )
  .join('\n');
mkdirSync(join(workaidDocs, 'data'), { recursive: true });
writeFileSync(join(workaidDocs, 'data', 'WORKAID_ACCEPTANCE_MATRIX_v0.2.csv'), csv + '\n');

/* ---------------- findings register ---------------- */
const sources = allSourceFindings();
const problems: string[] = [];
interface Entry {
  id: string;
  round: string;
  severity: string;
  sourceSeverity: string;
  title: string;
  sourceFile: string;
  sourceDisposition: string;
  triage: string;
  routes: Route[];
  primaryOwner: Route;
  group: string | null;
  overlaps: string[];
  disposition: string;
  proofLevel: 'NONE' | 'SYNTHETIC_CONTRACT' | 'SYNTHETIC_REPRO_OF_PLATFORM_DEFECT';
  tests: { tag: string; status: string }[];
  gap: string;
}
const register: Entry[] = sources.map((s) => {
  const ov = OVERLAY[s.id];
  if (!ov) {
    problems.push(`no overlay for ${s.id}`);
    return undefined as never;
  }
  const testTags = (ov.tests ?? []).map(full);
  const evidence = testTags.map((tag) => ({ tag, status: tagStatus(tag) }));
  for (const e of evidence) if (e.status !== 'PASS') problems.push(`${s.id} cites ${e.tag} but its status is ${e.status}`);
  const onlyRepro = testTags.length > 0 && testTags.every((t) => [...(tags.get(t)?.files ?? [])].every((f) => f.endsWith('platform-repro.test.ts')));
  const platformOwned = ov.routes[0] === 'CODEX_PLATFORM';
  let disposition = ov.disposition ?? (s.sourceDisposition === 'BLOCKED_EXTERNAL_EVIDENCE' ? 'BLOCKED_EXTERNAL_EVIDENCE' : s.sourceDisposition === 'PARTIALLY_MITIGATED' ? 'PARTIALLY_MITIGATED' : 'OPEN');
  // A synthetic contract proof of a WorkAid-owned design never closes a finding; it only records partial mitigation.
  if (!ov.disposition && !platformOwned && evidence.length > 0 && evidence.every((e) => e.status === 'PASS') && ov.routes.includes('WORKAID_PREP')) disposition = 'PARTIALLY_MITIGATED';
  return {
    id: s.id,
    round: s.round,
    severity: s.severity,
    sourceSeverity: s.sourceSeverity,
    title: ov.title,
    sourceFile: s.sourceFile,
    sourceDisposition: s.sourceDisposition,
    triage: ov.triage ?? (s.sourceDisposition === 'BLOCKED_EXTERNAL_EVIDENCE' ? 'BLOCKED' : ov.routes.includes('PROFESSIONAL_VALIDATION') ? 'NEEDS_VALIDATION' : 'ACCEPTED'),
    routes: [...ov.routes],
    primaryOwner: ov.routes[0]!,
    group: ov.group ?? null,
    overlaps: [...(ov.overlaps ?? [])],
    disposition,
    proofLevel: evidence.length === 0 ? 'NONE' : onlyRepro ? 'SYNTHETIC_REPRO_OF_PLATFORM_DEFECT' : 'SYNTHETIC_CONTRACT',
    tests: evidence,
    gap: ov.gap,
  };
});
const known = new Set(sources.map((s) => s.id));
for (const id of Object.keys(OVERLAY)) if (!known.has(id)) problems.push(`overlay for unknown finding ${id}`);
for (const e of register) for (const o of e.overlaps) if (!known.has(o)) problems.push(`${e.id} overlaps unknown ${o}`);
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

/* overlap symmetry check: if A lists B, B should list A (reported, not fatal) */
const asymmetric: string[] = [];
const byId = new Map(register.map((e) => [e.id, e]));
for (const e of register) for (const o of e.overlaps) if (!byId.get(o)!.overlaps.includes(e.id)) asymmetric.push(`${e.id} -> ${o}`);

const groups = new Map<string, Entry[]>();
for (const e of register) if (e.group) groups.set(e.group, [...(groups.get(e.group) ?? []), e]);

writeFileSync(
  join(workaidDocs, 'data', 'findings-register.json'),
  JSON.stringify(
    {
      schema: 'workaid-findings-register/1',
      generatedFromTestRun: { baseCommit: results.baseCommit, command: results.command },
      totals: { entries: register.length, byRound: countBy(register, (e) => e.round), bySeverity: countBy(register, (e) => e.severity), byDisposition: countBy(register, (e) => e.disposition) },
      entries: register,
    },
    null,
    2,
  ) + '\n',
);

/* ---------------- markdown: 09 findings register ---------------- */
const esc = (s: string) => s.replace(/\|/g, '\\|');
const sevOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const open = register.filter((e) => e.disposition !== 'OUT_OF_SCOPE_WITH_BOUNDARY');
const openP0 = open.filter((e) => e.severity === 'P0');
const openP1 = open.filter((e) => e.severity === 'P1');
const sev = (round: string) => countBy(register.filter((e) => e.round === round), (e) => e.sourceSeverity);

const md09: string[] = [];
md09.push('# 09 — Adversarial findings register (v0.2)');
md09.push('');
md09.push('> Generated by `tooling/workaid-prep/scripts/build-baseline.ts` from the source documents, `scripts/triage-overlay.ts` and the recorded test run. Do not edit by hand; edit the overlay and rebuild.');
md09.push('');
md09.push(`**Test run:** \`${results.command}\` on commit \`${results.baseCommit.slice(0, 9)}\`, ${results.totals.pass}/${results.totals.total} passing.`);
md09.push('');
md09.push('## Counts and reconciliation');
md09.push('');
md09.push('| Source | Entries | Severity as stated by source |');
md09.push('|---|---:|---|');
md09.push(`| R1 | ${register.filter((e) => e.round === 'R1').length} | ${JSON.stringify(sev('R1')).replace(/"/g, '')} |`);
md09.push(`| R2 | ${register.filter((e) => e.round === 'R2').length} | ${JSON.stringify(sev('R2')).replace(/"/g, '')} |`);
md09.push(`| R3 (Grok) | ${register.filter((e) => e.round === 'R3').length} | ${JSON.stringify(sev('R3')).replace(/"/g, '')} — counted from the 26 severity headings; the verdict footer's 8/14/4 is wrong |`);
md09.push(`| R4 | ${register.filter((e) => e.round === 'R4').length} | ${JSON.stringify(sev('R4')).replace(/"/g, '')} |`);
md09.push(`| R5 | ${register.filter((e) => e.round === 'R5').length} | ${JSON.stringify(sev('R5')).replace(/"/g, '')} |`);
md09.push(`| R6 | ${register.filter((e) => e.round === 'R6').length} | ${JSON.stringify(sev('R6')).replace(/"/g, '')} |`);
md09.push(`| WA-INT (triage hypotheses) | ${register.filter((e) => e.round === 'INT').length} | P1 ×3, source-confirmed at the pinned SHA |`);
md09.push(`| **Total source entries** | **${register.length}** | These are entries, **not** ${register.length} independent defects |`);
md09.push('');
md09.push(`Consolidated into **${groups.size} overlap groups** (plus ${register.filter((e) => !e.group).length} ungrouped entries). Normalized severity: P0 ${register.filter((e) => e.severity === 'P0').length}, P1 ${register.filter((e) => e.severity === 'P1').length}, P2 ${register.filter((e) => e.severity === 'P2').length}, P3 ${register.filter((e) => e.severity === 'P3').length} (CRITICAL→P0, HIGH→P1, MEDIUM→P2, LOW→P3).`);
md09.push('');
md09.push('| Disposition | Count |');
md09.push('|---|---:|');
for (const [k, v] of Object.entries(countBy(register, (e) => e.disposition)).sort()) md09.push(`| ${k} | ${v} |`);
md09.push(`| FIXED_PROVEN | 0 |`);
md09.push('');
md09.push(`**Open P0: ${openP0.length}. Open P1: ${openP1.length}.** \`FIXED_PROVEN\` is not used anywhere: no finding has executable evidence of a fix on the operational platform, and a synthetic contract test of a proposed design is recorded only as \`PARTIALLY_MITIGATED\` with \`proofLevel\`.`);
md09.push('');
md09.push('Triage status (mission §9): ' + Object.entries(countBy(register, (e) => e.triage)).map(([k, v]) => `${k} ${v}`).join(', ') + '. No finding is `REJECTED_WITH_EVIDENCE`: several were narrowed (for example WA-R3-006 is a confirmed unsafe intent, not a proven one-year exposure) but none was disproven.');
md09.push('');
md09.push('## Consolidated groups');
md09.push('');
md09.push('| Group | Entries | Highest severity | Primary owner |');
md09.push('|---|---|---|---|');
for (const [g, es] of [...groups.entries()].sort()) {
  const top = es.map((e) => e.severity).sort((a, b) => sevOrder[a]! - sevOrder[b]!)[0];
  md09.push(`| ${g} | ${es.map((e) => e.id.replace('WA-', '')).join(', ')} | ${top} | ${[...new Set(es.map((e) => e.primaryOwner))].join(', ')} |`);
}
md09.push('');
md09.push('`PLATFORM-GATE` records WA-R3-017 and WA-R3-025 as one release gate ("Union Eyes remains NO_GO"), not two vulnerabilities.');
md09.push('');
md09.push('## Register');
md09.push('');
md09.push('Proof: `CONTRACT` = executed in the isolated synthetic harness; `REPRO` = synthetic reproduction of a platform defect (the platform is unchanged); `—` = nothing executed. **No row is runtime proof.**');
md09.push('');
md09.push('| ID | Sev | Finding | Owner | Group | Overlaps | Disposition | Proof | Tests | Outstanding gap |');
md09.push('|---|---|---|---|---|---|---|---|---|---|');
for (const e of [...register].sort((a, b) => sevOrder[a.severity]! - sevOrder[b.severity]! || a.id.localeCompare(b.id))) {
  md09.push(
    `| ${e.id} | ${e.severity} | ${esc(e.title)} | ${e.routes.join('+')} | ${e.group ?? ''} | ${e.overlaps.map((o) => o.replace('WA-', '')).join(', ')} | ${e.disposition} | ${e.proofLevel === 'NONE' ? '—' : e.proofLevel === 'SYNTHETIC_CONTRACT' ? 'CONTRACT' : 'REPRO'} | ${e.tests.map((t) => t.tag.replace('WA-', '')).join(', ')} | ${esc(e.gap)} |`,
  );
}
md09.push('');
md09.push(`Overlap links are directional hints from the triage; ${asymmetric.length} of them are not reciprocated in the other entry and are listed in \`data/findings-register.json\` only by their source side.`);
writeFileSync(join(workaidDocs, '09_ADVERSARIAL_FINDINGS_REGISTER.md'), md09.join('\n') + '\n');

/* ---------------- markdown: 08 test report ---------------- */
const byFile = countBy(results.cases, (c) => c.file);
const failing = results.cases.filter((c) => c.status === 'FAIL');
const ids = (s: string) => matrixOut.filter((r) => r.status === s).map((r) => r.id.replace('WA-', ''));
const advResult = (id: string) => {
  const s = tagStatus(id);
  return s === 'PASS' ? 'PASS (synthetic contract)' : s === 'FAIL' ? 'FAIL' : 'NOT EXECUTED';
};
const md08: string[] = [];
md08.push('# 08 — Synthetic test report');
md08.push('');
md08.push('> Generated from the recorded run in `evidence/test-results.json`. A pass here proves that an isolated, pure contract behaves as specified against fabricated data. It is **not** runtime evidence and closes no runtime gate.');
md08.push('');
md08.push('## Run');
md08.push('');
md08.push(`- Command: \`${results.command}\` (from \`tooling/workaid-prep\`, via \`node scripts/run-tests.ts\`)`);
md08.push(`- Node ${results.node}; no dependency installed, no workspace file changed.`);
md08.push(`- Base commit: \`${results.baseCommit}\`; working tree dirty at run time: ${results.workingTreeDirty} (the files under test are uncommitted until the slice is committed).`);
md08.push(`- Result: **${results.totals.pass} passed, ${results.totals.fail} failed, ${results.totals.skipped} skipped** of ${results.totals.total} test cases.`);
md08.push('');
md08.push('| Test file | Cases |');
md08.push('|---|---:|');
for (const [f, n] of Object.entries(byFile).sort()) md08.push(`| ${f} | ${n} |`);
md08.push('');
md08.push(failing.length === 0 ? 'No failing tests.' : failing.map((f) => `- FAIL: ${f.file}: ${f.name}`).join('\n'));
md08.push('');
md08.push('## Acceptance matrix v0.2 (100 cases: WA-T001–T080 from the pack, WA-T081–T100 from the Grok delta)');
md08.push('');
md08.push('| State | Count | Meaning |');
md08.push('|---|---:|---|');
md08.push(`| EXECUTED_SYNTHETIC_PASS | ${matrixCounts['EXECUTED_SYNTHETIC_PASS'] ?? 0} | At least one tagged test, all passing. Scope is the tagged test titles in the CSV; see caveat below. |`);
md08.push(`| EXECUTED_SYNTHETIC_FAIL | ${matrixCounts['EXECUTED_SYNTHETIC_FAIL'] ?? 0} | A tagged test failed. |`);
md08.push(`| BLOCKED_RUNTIME_OR_EXTERNAL | ${matrixCounts['BLOCKED_RUNTIME_OR_EXTERNAL'] ?? 0} | Cannot be executed in isolation (needs deployed runtime, UI, identity provider, legal decision or pilot data). |`);
md08.push(`| DESIGNED_NOT_EXECUTED | ${matrixCounts['DESIGNED_NOT_EXECUTED'] ?? 0} | Could be executed in the isolated harness but has not been. |`);
md08.push('');
md08.push('**Caveat.** A matrix row is marked `EXECUTED_SYNTHETIC_PASS` when a test carrying its id passes. Several rows describe a platform surface (search, export, aggregates, runtime sessions) of which the harness exercises only the domain contract; the `Evidence` column in `data/WORKAID_ACCEPTANCE_MATRIX_v0.2.csv` names exactly what ran, and `Runtime_gate` is `NOT_CLOSED` on every row. Rows whose only tests are `platform-repro.test.ts` are labelled `SYNTHETIC_REPRO_OF_PLATFORM_DEFECT`: they show the defect is reproducible and the proposed assertion is satisfiable, not that the platform is fixed.');
md08.push('');
md08.push(`- **EXECUTED_SYNTHETIC_PASS (${ids('EXECUTED_SYNTHETIC_PASS').length}):** ${ids('EXECUTED_SYNTHETIC_PASS').join(', ')}`);
md08.push(`- **BLOCKED_RUNTIME_OR_EXTERNAL (${ids('BLOCKED_RUNTIME_OR_EXTERNAL').length}):** ${ids('BLOCKED_RUNTIME_OR_EXTERNAL').join(', ')}`);
md08.push(`- **DESIGNED_NOT_EXECUTED (${ids('DESIGNED_NOT_EXECUTED').length}):** ${ids('DESIGNED_NOT_EXECUTED').join(', ')}`);
md08.push('');
md08.push('## Required adversarial tests (mission §8)');
md08.push('');
md08.push('| # | Test | Requirement IDs | Threat | Preconditions | Inputs | Expected | Actual | Result | Outstanding gap |');
md08.push('|---:|---|---|---|---|---|---|---|---|---|');
for (const c of ADVERSARIAL_CASES) {
  const t = tags.get(c.id);
  md08.push(
    `| ${c.n} | ${esc(c.title)} | ${c.requirements.join(', ')} | ${esc(c.threat)} | ${esc(c.preconditions)} | ${esc(c.inputs)} | ${esc(c.expected)} | ${t ? `${t.pass} test(s) passed, ${t.fail} failed` : 'not executed'} | ${advResult(c.id)} | ${esc(c.gap)} |`,
  );
}
md08.push('');
md08.push('Evidence for each adversarial case is the tagged test title in `evidence/test-results.json` (`[WA-ADV-nn]`). "PASS (synthetic contract)" is deliberately not the word PASS alone.');
writeFileSync(join(workaidDocs, '08_SYNTHETIC_TEST_REPORT.md'), md08.join('\n') + '\n');

/* ---------------- markdown: 02 requirements traceability ---------------- */
const matrixIds = new Set(rows.map((r) => r.id));
const reqProblems: string[] = [];
const reqRows = REQUIREMENTS.map((r) => {
  for (const m of r.matrix) if (!matrixIds.has(m) && !m.startsWith('WA-ADV-')) reqProblems.push(`${r.id}: unknown matrix id ${m}`);
  for (const f of r.findings) if (!known.has(f) && !f.includes('..')) reqProblems.push(`${r.id}: unknown finding ${f}`);
  const st = r.matrix.map((m) => tagStatus(m));
  const status = r.matrix.length === 0 ? 'NO_TAGGED_TEST' : st.includes('FAIL') ? 'FAIL' : st.every((s) => s === 'PASS') ? 'COVERED_SYNTHETIC' : st.includes('PASS') ? 'PARTIAL_SYNTHETIC' : 'NOT_EXECUTED';
  return { ...r, status };
});
if (reqProblems.length > 0) {
  console.error(reqProblems.join('\n'));
  process.exit(1);
}
const md02: string[] = [];
md02.push('# 02 — Requirements traceability (v0.2 baseline)');
md02.push('');
md02.push('> Generated from `scripts/requirements.ts` and the recorded test run. `status` is derived, never asserted: `COVERED_SYNTHETIC` means every cited matrix or adversarial case has a passing synthetic test; it does not mean the requirement is implemented in the operational application. `PARTIAL_SYNTHETIC` means some cited cases are still unexecuted. `NO_TAGGED_TEST` means no matrix case is cited (a unit test may still exist, but it is not claimed as evidence here).');
md02.push('');
md02.push('| Requirement | Area | Requirement text | Source | Harness module | Cases | Findings | Open decisions | Status |');
md02.push('|---|---|---|---|---|---|---|---|---|');
for (const r of reqRows) {
  md02.push(`| ${r.id} | ${r.area} | ${esc(r.text)} | ${esc(r.source)} | \`${r.module}\` | ${r.matrix.map((m) => m.replace('WA-', '')).join(', ')} | ${r.findings.map((f) => f.replace('WA-', '')).join(', ')} | ${r.decisions.join(', ')} | ${r.status} |`);
}
md02.push('');
md02.push(`${reqRows.length} requirements: ` + Object.entries(countBy(reqRows, (r) => r.status)).map(([k, v]) => `${k} ${v}`).join(', ') + '.');
writeFileSync(join(workaidDocs, '02_REQUIREMENTS_TRACEABILITY.md'), md02.join('\n') + '\n');

console.log(JSON.stringify({ matrix: matrixCounts, register: { total: register.length, groups: groups.size, openP0: openP0.length, openP1: openP1.length, dispositions: countBy(register, (e) => e.disposition) }, asymmetricOverlaps: asymmetric.length }));
