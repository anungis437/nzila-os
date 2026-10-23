import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { baselineDir, grokDir, allSourceFindings, parseCsv, parseExtension, parseGrokDelta, parsePackMatrix, parseR1, parseR2, parseR3, read, sha256, INTAKE_HYPOTHESES } from '../scripts/sources.ts';

/**
 * Verifies the actual files of the preparation pack and the Grok deliverables:
 * hashes, counts, uniqueness and cross-references. Nothing here assumes that a
 * test described in the pack was ever executed.
 */
describe('baseline pack v0.1 integrity', () => {
  const manifest = JSON.parse(read(join(baselineDir, 'MANIFEST.json'))) as { files: { name: string; bytes: number; sha256: string }[]; acceptanceCases: number; syntheticScenarios: number; adversarialFindings: number; releaseReadiness: string };

  it('every manifest file is present and matches its recorded size and SHA-256 (CSV compared as CRLF as shipped)', () => {
    for (const f of manifest.files) {
      const buf = readFileSync(join(baselineDir, f.name));
      const direct = sha256(buf);
      // The pack ships the CSV with CRLF; a repository checkout may normalize it to LF.
      const asCrlf = sha256(Buffer.from(buf.toString('utf8').replace(/\r?\n/g, '\r\n')));
      assert.ok(direct === f.sha256 || asCrlf === f.sha256, `${f.name} hash mismatch`);
    }
  });

  it('README, MANIFEST and the six working documents are all present (no missing attachment)', () => {
    for (const n of ['README.md', 'MANIFEST.json', 'WORKAID_PRODUCT_SPEC_v0.1.md', 'WORKAID_ADVERSARIAL_REVIEW_R1.md', 'WORKAID_ADVERSARIAL_REVIEW_R2.md', 'WORKAID_ACCEPTANCE_MATRIX.csv', 'WORKAID_SYNTHETIC_SCENARIOS.json', 'WORKAID_VSCODE_AGENT_MISSION.md']) {
      assert.ok(existsSync(join(baselineDir, n)), n);
    }
  });

  it('the pack claims 80 acceptance cases, 12 scenarios and 31 findings; the files actually contain exactly that', () => {
    const matrix = parsePackMatrix();
    assert.equal(manifest.acceptanceCases, 80);
    assert.equal(matrix.length, 80);
    assert.deepEqual(matrix.map((r) => r.id), Array.from({ length: 80 }, (_, i) => `WA-T${String(i + 1).padStart(3, '0')}`));
    const scenarios = JSON.parse(read(join(baselineDir, 'WORKAID_SYNTHETIC_SCENARIOS.json'))) as { scenarios: { id: string; targetTests: string[] }[] };
    assert.equal(manifest.syntheticScenarios, 12);
    assert.equal(scenarios.scenarios.length, 12);
    assert.equal(parseR1().length, 22);
    assert.equal(parseR2().length, 9);
    assert.equal(manifest.adversarialFindings, 31);
    assert.equal(parseR1().length + parseR2().length, 31);
  });

  it('the pack marks every acceptance case DESIGNED_NOT_EXECUTED and declares NO_GO', () => {
    assert.ok(parsePackMatrix().every((r) => r.priorState === 'DESIGNED_NOT_EXECUTED'));
    assert.equal(manifest.releaseReadiness, 'NO_GO');
  });

  it('scenario target tests all reference real matrix cases, and every fixture is synthetic with deliberately invalid external ids', () => {
    const ids = new Set(parsePackMatrix().map((r) => r.id));
    const raw = read(join(baselineDir, 'WORKAID_SYNTHETIC_SCENARIOS.json'));
    const scenarios = JSON.parse(raw) as { fixturePolicy: string; scenarios: { id: string; synthetic: boolean; targetTests: string[]; claims?: { externalNumber: string }[] }[] };
    assert.match(scenarios.fixturePolicy, /synthetic only/);
    for (const s of scenarios.scenarios) {
      assert.equal(s.synthetic, true, s.id);
      for (const t of s.targetTests) assert.ok(ids.has(t), `${s.id} -> ${t}`);
      for (const c of s.claims ?? []) if (c.externalNumber !== undefined) assert.match(c.externalNumber, /^FAKE-WSIB-\d{6}$/);
    }
  });

  it('R1 and R2 finding ids are unique and severities are only CRITICAL/HIGH/MEDIUM and P0/P1', () => {
    const all = [...parseR1(), ...parseR2()];
    assert.equal(new Set(all.map((f) => f.id)).size, all.length);
    assert.deepEqual([...new Set(all.map((f) => f.sourceSeverity))].sort(), ['CRITICAL', 'HIGH', 'MEDIUM', 'P0', 'P1']);
  });
});

describe('Grok deliverables (R3-R6) integrity', () => {
  it('the nine delivered artifacts are present', () => {
    for (const n of ['WA_GROK_ACCEPTANCE_DELTA.csv', 'WA_GROK_ARCHITECTURE_CHALLENGE.md', 'WA_GROK_EXECUTIVE_VERDICT.md', 'WA_GROK_R3_ADVERSARIAL_FINDINGS.md', 'WA_GROK_REALITY_BASELINE.md', 'WA_GROK_REQUIREMENTS_DELTA.md', 'WA_GROK_REVIEW_EXTENSION.md', 'WA_GROK_SOURCE_REGISTER.md', 'WA_GROK_THREAT_MODEL.md']) {
      assert.ok(existsSync(join(grokDir, n)), n);
    }
    assert.ok(existsSync(join(grokDir, 'WorkAid_Grok_R3-R6_Triage_2026-10-23.md')));
  });

  it('R3 contains 26 findings: 8 P0, 15 P1, 3 P2 - counted from the severity headings, not the summary', () => {
    const r3 = parseR3();
    assert.equal(r3.length, 26);
    const count = (s: string) => r3.filter((f) => f.severity === s).length;
    assert.deepEqual({ P0: count('P0'), P1: count('P1'), P2: count('P2'), P3: count('P3') }, { P0: 8, P1: 15, P2: 3, P3: 0 });
  });

  it('the executive verdict contradicts itself: header table says 8/15/3, its footer says 8/14/4; the detailed file governs', () => {
    const verdict = read(join(grokDir, 'WA_GROK_EXECUTIVE_VERDICT.md'));
    assert.match(verdict, /26 findings \(8 P0 \/ 15 P1 \/ 3 P2\)/);
    assert.match(verdict, /P0:8 \/ P1:14 \/ P2:4 \(26 total\)/);
  });

  it('R4-R6 contain 31 findings (CRITICAL 7, HIGH 15, MEDIUM 8, LOW 1) split 12/10/9', () => {
    const ext = parseExtension();
    assert.equal(ext.length, 31);
    const by = (k: 'round' | 'sourceSeverity') => (v: string) => ext.filter((f) => f[k] === v).length;
    assert.deepEqual(['R4', 'R5', 'R6'].map(by('round')), [12, 10, 9]);
    assert.deepEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(by('sourceSeverity')), [7, 15, 8, 1]);
  });

  it('the acceptance delta adds exactly WA-T081..WA-T100 with no id collision with the 80 existing cases', () => {
    const delta = parseGrokDelta();
    assert.deepEqual(delta.map((r) => r.id), Array.from({ length: 20 }, (_, i) => `WA-T${String(81 + i).padStart(3, '0')}`));
    const existing = new Set(parsePackMatrix().map((r) => r.id));
    for (const r of delta) assert.equal(existing.has(r.id), false);
  });

  it('every finding id cited by the delta resolves to a real R3 finding', () => {
    const r3 = new Set(parseR3().map((f) => f.id));
    for (const r of parseGrokDelta()) for (const f of r.relatedFindings.split(/\s+/).filter(Boolean)) assert.ok(r3.has(f), `${r.id} cites ${f}`);
  });

  it('all source findings: 91 original entries unchanged (R1 22, R2 9, R3 26, R4-R6 31, INT 3) plus 3 Slice C entries; ids unique, nothing renumbered', () => {
    const all = allSourceFindings();
    const original = all.filter((f) => f.round !== 'C');
    assert.equal(original.length, 22 + 9 + 26 + 31 + INTAKE_HYPOTHESES.length);
    assert.equal(original.length, 91);
    assert.deepEqual(all.filter((f) => f.round === 'C').map((f) => f.id), ['WA-C-001', 'WA-C-002', 'WA-C-003']);
    assert.equal(all.length, 94);
    assert.equal(new Set(all.map((f) => f.id)).size, 94);
  });

  it('the CSV parser handles quoted commas and CRLF', () => {
    assert.deepEqual(parseCsv('a,b\r\n"x, y",z\r\n'), [['a', 'b'], ['x, y', 'z']]);
  });
});
