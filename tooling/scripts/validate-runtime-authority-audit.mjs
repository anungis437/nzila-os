#!/usr/bin/env node
// Validates that the Union Eyes runtime authority audit Wave 1 deliverables
// exist and contain their required mandatory sections.

import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import { resolveUeAreaDir } from './lib/ue-doc-paths.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const auditDir = resolveUeAreaDir(repoRoot, 'runtime-authority-audit');
const auditDirRel = relative(repoRoot, auditDir).replaceAll('\\', '/');

const required = [
  {
    file: 'README.md',
    sections: ['Wave 1 deliverables', 'Outstanding waves', 'Validator'],
  },
  {
    file: 'scan-snapshot.md',
    sections: ['Provenance', 'Raw counts', 'Implications'],
  },
  {
    file: 'full-page-route-authority-audit.md',
    sections: [
      'Marketing surface',
      'Auth surface',
      'Dashboard surface',
      'Portal surface',
      'Mandatory sections checklist',
    ],
  },
  {
    file: 'full-canonical-module-inventory.md',
    sections: [
      'Canonical platform pillars',
      'Operational modules',
      'Confirmed retire',
      'merge candidates',
      'Mandatory sections checklist',
    ],
  },
  {
    file: 'full-legacy-surface-elimination.md',
    sections: ['Tier A', 'Tier B', 'Tier C', 'Execution status', 'Mandatory sections checklist'],
  },
  {
    file: 'full-feature-gating-hardening.md',
    sections: ['Current posture', 'Posture analysis', 'Hardening plan', 'Mandatory sections checklist'],
  },
  {
    file: 'full-stakeholder-visibility-matrix.md',
    sections: [
      'Stakeholder bands',
      'Surface',
      'Visibility per existing E2E fixture',
      'Mandatory sections checklist',
    ],
  },
  {
    file: 'full-monetization-runtime-alignment.md',
    sections: [
      'Tier model',
      'Surface',
      'Tier coherence check',
      'Pricing alignment',
      'Mandatory sections checklist',
    ],
  },
  {
    file: 'full-doctrine-alignment-sweep.md',
    sections: [
      'Doctrine pillars',
      'doctrine-aligned naming',
      'generic / SaaS framing',
      'Wave 4 work queue',
      'Mandatory sections checklist',
    ],
  },
  {
    file: 'wave3-runtime-consolidation-review.md',
    sections: [
      'Deleted route inventory',
      'Retained canonical routes',
      'Gating expansion',
      'Navigation convergence',
      'Doctrine normalization',
      'Runtime reduction metrics',
      'Stakeholder-boundary verdicts',
      'Final verdict',
    ],
  },
  {
    file: 'wave4-experience-convergence-review.md',
    sections: [
      'Executive convergence results',
      'Navigation reduction results',
      'Pricing convergence results',
      'Stakeholder simplification results',
      'Sovereignty-layer differentiation results',
      'Runtime contraction metrics',
      'Remaining overlap candidates',
      'Remaining deferred runtime surfaces',
      'Final verdicts',
    ],
  },
  {
    file: 'wave5-institutional-refinement-review.md',
    sections: [
      'Executive collapse results',
      'Governance collapse results',
      'Institutional-memory collapse results',
      'Operations collapse results',
      'Sovereignty embodiment results',
      'Runtime density metrics',
      'Nav contraction metrics',
      'Stakeholder-lane refinement',
      'Procurement calmness',
      'Remaining deferred overlaps',
      'Final verdicts',
    ],
  },
  {
    file: 'wave6-institutional-inevitability-review.md',
    sections: [
      'Sovereignty atmosphere refinement results',
      'Cadence embodiment results',
      'Executive calmness results',
      'Procurement atmosphere results',
      'Platform ontology collapse results',
      'Runtime pacing results',
      'Stakeholder emotional clarity review',
      'Continuity-language finalization review',
      'Remaining deferred refinement items',
      'Final verdicts',
      'Institutional inevitability',
    ],
  },
  {
    file: 'wave7-procurement-inevitability-review.md',
    sections: [
      'Procurement trust refinement results',
      'Trust-center convergence results',
      'Executive reassurance results',
      'Onboarding trust refinement results',
      'Stakeholder operational confidence results',
      'Continuity-language sweep results',
      'Operational rhythm refinement results',
      'Pilot/procurement walkthrough results',
      'Remaining deferred refinements',
      'Final verdicts',
      'procurement inevitability',
      'institutional trust',
    ],
  },
  {
    file: 'wave8-institutional-permanence-review.md',
    sections: [
      'Procurement-grade language convergence results',
      'fr-CA continuity parity results',
      'Operational rhythm choreography results',
      'Stakeholder emotional permanence results',
      'Trust-center constitutionalization results',
      'Pilot/procurement choreography results',
      'Runtime calmness results',
      'Remaining deferred refinements',
      'Final verdicts',
      'procurement-grade',
      'fr-CA continuity parity',
      'operational rhythm',
      'constitutional trust',
      'institutional permanence',
    ],
  },
  {
    file: 'wave9-constitutional-runtime-finalization-review.md',
    sections: [
      'Sovereignty bilingualization results',
      'Operational choreography completion results',
      'Constitutional trust finalization results',
      'Executive continuity confidence results',
      'Stakeholder certainty results',
      'Legacy language eradication results',
      'Runtime calmness hardening results',
      'Procurement & pilot inevitability hardening results',
      'Remaining deferred refinements',
      'Final verdicts',
      'sovereignty parity',
      'constitutional coherence',
      'bilingual continuity permanence',
      'procurement permanence',
    ],
  },
];

const failures = [];

for (const entry of required) {
  const path = join(auditDir, entry.file);
  try {
    await stat(path);
  } catch {
    failures.push(`Missing file: ${auditDirRel}/${entry.file}`);
    continue;
  }
  const text = await readFile(path, 'utf8');
  for (const section of entry.sections) {
    if (!text.toLowerCase().includes(section.toLowerCase())) {
      failures.push(`File ${entry.file}: missing required section "${section}"`);
    }
  }
}

if (failures.length > 0) {
  console.error('Runtime authority audit validation FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`OK — ${required.length} runtime authority audit documents validated.`);
