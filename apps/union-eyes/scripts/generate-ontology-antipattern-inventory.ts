#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { getNavigationForExperience, type DashboardExperience } from '../lib/dashboard/role-experience';

type DocReference = {
  path: string;
  requiredTerms: string[];
};

type AntiPatternRule = {
  id: string;
  phrase: string;
  classification: string;
  severity: string;
  enforcementPhase: 'A' | 'B' | 'C' | 'D';
  reason: string;
  appliesTo: string[];
};

type OntologyMatrix = {
  version: string;
  pricingTiers: string[];
  docsReferences: DocReference[];
  antiPatternIntelligence: {
    mode: 'warn' | 'error';
    calibrationClasses: string[];
    rules: AntiPatternRule[];
  };
};

type MatchEntry = {
  ruleId: string;
  phrase: string;
  classification: string;
  severity: string;
  enforcementPhase: string;
  sourceType: string;
  sourcePath: string;
  occurrences: number;
  reason: string;
};

type InventoryReport = {
  generatedAt: string;
  matrixVersion: string;
  mode: 'warn' | 'error';
  scannedSources: number;
  totalMatches: number;
  matchesBySeverity: Record<string, number>;
  matchesByClassification: Record<string, number>;
  promotionCandidates: MatchEntry[];
  matches: MatchEntry[];
};

const MATRIX_FILE = path.join(__dirname, '../config/continuity-ontology-matrix.json');
const REPO_ROOT = path.resolve(__dirname, '../../..');
const REPORTS_DIR = path.join(__dirname, '../reports');
const INVENTORY_JSON = path.join(REPORTS_DIR, 'ontology-antipattern-inventory.json');
const INVENTORY_MD = path.join(REPORTS_DIR, 'ontology-antipattern-inventory.md');

const EXPERIENCES: DashboardExperience[] = ['member', 'staff', 'executive', 'governance', 'admin'];

function fail(message: string): never {
  console.error(`Ontology anti-pattern inventory FAILED: ${message}`);
  process.exit(1);
}

function normalize(text: string): string {
  return text.toLowerCase();
}

function countOccurrences(content: string, phrase: string): number {
  if (!phrase) return 0;
  let count = 0;
  let start = 0;
  while (true) {
    const idx = content.indexOf(phrase, start);
    if (idx === -1) break;
    count += 1;
    start = idx + phrase.length;
  }
  return count;
}

type Signal = {
  sourceType: string;
  sourcePath: string;
  content: string;
};

function getTextFilesRecursively(rootPath: string): string[] {
  if (!fs.existsSync(rootPath)) return [];

  const stack = [rootPath];
  const files: string[] = [];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      const children = fs.readdirSync(current);
      for (const child of children) {
        stack.push(path.join(current, child));
      }
      continue;
    }

    if (current.endsWith('.md') || current.endsWith('.mdx') || current.endsWith('.ts') || current.endsWith('.tsx')) {
      files.push(current);
    }
  }

  return files;
}

function relativeRepoPath(absolutePath: string): string {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/');
}

function collectSignals(matrix: OntologyMatrix): Signal[] {
  const signals: Signal[] = [];

  for (const docRef of matrix.docsReferences) {
    const absoluteDocPath = path.join(REPO_ROOT, docRef.path);
    if (!fs.existsSync(absoluteDocPath)) continue;
    signals.push({
      sourceType: 'docs',
      sourcePath: docRef.path,
      content: normalize(fs.readFileSync(absoluteDocPath, 'utf-8')),
    });
  }

  const marketingRoots = [
    path.join(REPO_ROOT, 'apps/union-eyes/app/[locale]/(marketing)'),
    path.join(REPO_ROOT, 'docs/categories/products-and-market/union-eyes'),
    path.join(REPO_ROOT, 'docs/doctrine/whitepapers'),
    path.join(REPO_ROOT, 'content/public'),
  ];

  for (const root of marketingRoots) {
    const files = getTextFilesRecursively(root);
    for (const file of files) {
      signals.push({
        sourceType: 'docs',
        sourcePath: relativeRepoPath(file),
        content: normalize(fs.readFileSync(file, 'utf-8')),
      });
    }
  }

  signals.push({
    sourceType: 'pricing',
    sourcePath: 'pricingTiers',
    content: normalize(matrix.pricingTiers.join(' | ')),
  });

  const navLabels: string[] = [];
  for (const experience of EXPERIENCES) {
    const navigation = getNavigationForExperience(experience);
    for (const item of navigation) {
      navLabels.push(item.label);
      if (item.group) navLabels.push(item.group);
    }
  }

  signals.push({
    sourceType: 'navLabels',
    sourcePath: 'apps/union-eyes/lib/dashboard/role-experience.ts',
    content: normalize(navLabels.join(' | ')),
  });

  return signals;
}

function toMarkdown(report: InventoryReport): string {
  const lines: string[] = [];
  lines.push('# Ontology Anti-pattern Inventory');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Matrix version: ${report.matrixVersion}`);
  lines.push(`Mode: ${report.mode}`);
  lines.push(`Scanned sources: ${report.scannedSources}`);
  lines.push(`Total matches: ${report.totalMatches}`);
  lines.push('');
  lines.push('## Matches by Severity');
  lines.push('');
  for (const [severity, count] of Object.entries(report.matchesBySeverity)) {
    lines.push(`- ${severity}: ${count}`);
  }
  lines.push('');
  lines.push('## Matches by Classification');
  lines.push('');
  for (const [classification, count] of Object.entries(report.matchesByClassification)) {
    lines.push(`- ${classification}: ${count}`);
  }
  lines.push('');
  lines.push('## Promotion Candidates');
  lines.push('');
  if (report.promotionCandidates.length === 0) {
    lines.push('- none');
  } else {
    for (const candidate of report.promotionCandidates) {
      lines.push(
        `- ${candidate.ruleId} (${candidate.severity}/${candidate.classification}) in ${candidate.sourceType}:${candidate.sourcePath} occurrences=${candidate.occurrences}`,
      );
    }
  }
  lines.push('');
  lines.push('## Matches');
  lines.push('');
  if (report.matches.length === 0) {
    lines.push('- none');
  } else {
    for (const match of report.matches) {
      lines.push(
        `- ${match.ruleId} phrase="${match.phrase}" class=${match.classification} severity=${match.severity} phase=${match.enforcementPhase} source=${match.sourceType}:${match.sourcePath} occurrences=${match.occurrences}`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

function main(): void {
  if (!fs.existsSync(MATRIX_FILE)) {
    fail(`Missing ontology matrix: ${MATRIX_FILE}`);
  }

  const matrix = JSON.parse(fs.readFileSync(MATRIX_FILE, 'utf-8')) as OntologyMatrix;
  const policy = matrix.antiPatternIntelligence;

  if (!policy || !Array.isArray(policy.rules) || policy.rules.length === 0) {
    fail('antiPatternIntelligence policy is missing or empty.');
  }

  const signals = collectSignals(matrix);
  const matches: MatchEntry[] = [];

  for (const rule of policy.rules) {
    const phrase = normalize(rule.phrase.trim());
    if (!phrase) continue;

    const applicableSignals = signals.filter((signal) => rule.appliesTo.includes(signal.sourceType));
    for (const signal of applicableSignals) {
      const occurrences = countOccurrences(signal.content, phrase);
      if (occurrences === 0) continue;

      matches.push({
        ruleId: rule.id,
        phrase: rule.phrase,
        classification: rule.classification,
        severity: rule.severity,
        enforcementPhase: rule.enforcementPhase,
        sourceType: signal.sourceType,
        sourcePath: signal.sourcePath,
        occurrences,
        reason: rule.reason,
      });
    }
  }

  const matchesBySeverity: Record<string, number> = {};
  const matchesByClassification: Record<string, number> = {};
  for (const match of matches) {
    matchesBySeverity[match.severity] = (matchesBySeverity[match.severity] ?? 0) + match.occurrences;
    matchesByClassification[match.classification] = (matchesByClassification[match.classification] ?? 0) + match.occurrences;
  }

  const promotionCandidates = matches.filter((match) => {
    const protectedClass = match.classification === 'surveillance-adjacent-language' || match.classification === 'doctrine-violation';
    return protectedClass && match.severity === 'high';
  });

  const report: InventoryReport = {
    generatedAt: new Date().toISOString(),
    matrixVersion: matrix.version,
    mode: policy.mode,
    scannedSources: signals.length,
    totalMatches: matches.reduce((sum, entry) => sum + entry.occurrences, 0),
    matchesBySeverity,
    matchesByClassification,
    promotionCandidates,
    matches,
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(INVENTORY_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  fs.writeFileSync(INVENTORY_MD, toMarkdown(report), 'utf-8');

  console.log(`OK - ontology anti-pattern inventory generated at reports/ontology-antipattern-inventory.json (${report.totalMatches} matches across ${report.scannedSources} sources).`);
}

main();
