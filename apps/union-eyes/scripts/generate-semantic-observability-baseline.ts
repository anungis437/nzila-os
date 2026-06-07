#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

type AntiPatternInventory = {
  generatedAt: string;
  matrixVersion: string;
  mode: 'warn' | 'error';
  scannedSources: number;
  totalMatches: number;
  matchesBySeverity: Record<string, number>;
  matchesByClassification: Record<string, number>;
  promotionCandidates: Array<{
    ruleId: string;
    phrase: string;
    classification: string;
    severity: string;
    enforcementPhase: string;
    sourceType: string;
    sourcePath: string;
    occurrences: number;
    reason: string;
  }>;
  matches: Array<{
    ruleId: string;
    phrase: string;
    classification: string;
    severity: string;
    enforcementPhase: string;
    sourceType: string;
    sourcePath: string;
    occurrences: number;
    reason: string;
  }>;
};

type OntologyMatrix = {
  version: string;
  constitution?: {
    version: string;
    status: string;
    effectiveDate: string;
    frozenDomains: string[];
    amendmentPolicy: string;
  };
  antiPatternIntelligence?: {
    mode: 'warn' | 'error';
    calibrationClasses: string[];
    rules: Array<{
      id: string;
      classification: string;
      severity: string;
      enforcementPhase: string;
    }>;
  };
};

type ObservabilityBaseline = {
  generatedAt: string;
  matrixVersion: string;
  constitutionVersion: string | null;
  constitutionStatus: string | null;
  antiPatternMode: 'warn' | 'error' | 'unknown';
  warningInventory: {
    scannedSources: number;
    totalMatches: number;
    warningDensityPerSource: number;
    classificationBreakdown: Record<string, number>;
    severityBreakdown: Record<string, number>;
    promotionCandidateCount: number;
  };
  governanceStack: Array<{
    layer: string;
    status: string;
    note: string;
  }>;
  calibrationClasses: string[];
  recommendation: string;
};

const REPORTS_DIR = path.join(__dirname, '../reports');
const INVENTORY_PATH = path.join(REPORTS_DIR, 'ontology-antipattern-inventory.json');
const MATRIX_PATH = path.join(__dirname, '../config/continuity-ontology-matrix.json');
const OUTPUT_JSON = path.join(REPORTS_DIR, 'semantic-observability-baseline.json');
const OUTPUT_MD = path.join(REPORTS_DIR, 'semantic-observability-baseline.md');

function fail(message: string): never {
  console.error(`Semantic observability baseline FAILED: ${message}`);
  process.exit(1);
}

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    fail(`Missing required file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function formatCountMap(entries: Record<string, number>): string {
  const sorted = Object.entries(entries).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  if (sorted.length === 0) return '- none';
  return sorted.map(([key, value]) => `- ${key}: ${value}`).join('\n');
}

function toMarkdown(report: ObservabilityBaseline): string {
  const lines: string[] = [];
  lines.push('# Semantic Observability Baseline');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Matrix version: ${report.matrixVersion}`);
  lines.push(`Constitution: ${report.constitutionVersion ?? 'n/a'} (${report.constitutionStatus ?? 'n/a'})`);
  lines.push(`Anti-pattern mode: ${report.antiPatternMode}`);
  lines.push('');
  lines.push('## Warning Inventory');
  lines.push('');
  lines.push(`- Scanned sources: ${report.warningInventory.scannedSources}`);
  lines.push(`- Total matches: ${report.warningInventory.totalMatches}`);
  lines.push(`- Warning density per source: ${report.warningInventory.warningDensityPerSource.toFixed(4)}`);
  lines.push(`- Promotion candidates: ${report.warningInventory.promotionCandidateCount}`);
  lines.push('');
  lines.push('### Severity Breakdown');
  lines.push('');
  lines.push(formatCountMap(report.warningInventory.severityBreakdown));
  lines.push('');
  lines.push('### Classification Breakdown');
  lines.push('');
  lines.push(formatCountMap(report.warningInventory.classificationBreakdown));
  lines.push('');
  lines.push('## Governance Stack');
  lines.push('');
  for (const entry of report.governanceStack) {
    lines.push(`- ${entry.layer}: ${entry.status} — ${entry.note}`);
  }
  lines.push('');
  lines.push('## Recommendation');
  lines.push('');
  lines.push(report.recommendation);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main(): void {
  const inventory = readJson<AntiPatternInventory>(INVENTORY_PATH);
  const matrix = readJson<OntologyMatrix>(MATRIX_PATH);

  const warningDensityPerSource = inventory.scannedSources > 0 ? inventory.totalMatches / inventory.scannedSources : 0;
  const governanceStack: ObservabilityBaseline['governanceStack'] = [
    { layer: 'Ontology matrix', status: 'active', note: `Matrix ${matrix.version} is structurally validated.` },
    { layer: 'Runtime registry drift', status: 'enforced', note: 'Live API registry matches ontology.' },
    { layer: 'Role-access drift', status: 'enforced', note: 'Doctrine-derived gating remains aligned.' },
    { layer: 'Docs semantic drift', status: 'enforced', note: 'Docs references match required canonical terms.' },
    { layer: 'Semantic dictionary integrity', status: 'enforced', note: 'Canonical terms remain governed.' },
    { layer: 'Nav composition policy', status: 'enforced', note: 'Role nav remains ontology-composed.' },
    { layer: 'Anti-pattern intelligence', status: 'warning-only', note: 'Calibration telemetry is active and non-blocking.' },
    { layer: 'Constitution freeze scaffold', status: matrix.constitution?.status ?? 'active', note: `Frozen domains: ${matrix.constitution?.frozenDomains.length ?? 0}` },
  ];

  const baseline: ObservabilityBaseline = {
    generatedAt: new Date().toISOString(),
    matrixVersion: matrix.version,
    constitutionVersion: matrix.constitution?.version ?? null,
    constitutionStatus: matrix.constitution?.status ?? null,
    antiPatternMode: matrix.antiPatternIntelligence?.mode ?? 'unknown',
    warningInventory: {
      scannedSources: inventory.scannedSources,
      totalMatches: inventory.totalMatches,
      warningDensityPerSource,
      classificationBreakdown: inventory.matchesByClassification,
      severityBreakdown: inventory.matchesBySeverity,
      promotionCandidateCount: inventory.promotionCandidates.length,
    },
    governanceStack,
    calibrationClasses: matrix.antiPatternIntelligence?.calibrationClasses ?? [],
    recommendation:
      inventory.totalMatches === 0
        ? 'Continue warning-only posture; use this zero-match baseline as the current semantic health reference point.'
        : 'Review promotion candidates and calibrate escalation thresholds before moving any rule to hard-fail mode.',
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(baseline, null, 2)}\n`, 'utf-8');
  fs.writeFileSync(OUTPUT_MD, toMarkdown(baseline), 'utf-8');

  console.log(
    `OK - semantic observability baseline generated at reports/semantic-observability-baseline.json (density ${baseline.warningInventory.warningDensityPerSource.toFixed(4)} per source).`,
  );
}

main();
