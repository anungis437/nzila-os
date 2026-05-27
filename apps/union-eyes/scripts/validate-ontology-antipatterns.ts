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
  enforcementPhase: string;
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

const MATRIX_FILE = path.join(__dirname, '../config/continuity-ontology-matrix.json');
const REPO_ROOT = path.resolve(__dirname, '../../..');
const EXPERIENCES: DashboardExperience[] = ['member', 'staff', 'executive', 'governance', 'admin'];

function fail(message: string): never {
  console.error(`Ontology anti-pattern validation FAILED: ${message}`);
  process.exit(1);
}

function normalize(text: string): string {
  return text.toLowerCase();
}

type Signal = {
  source: string;
  target: string;
  content: string;
};

function collectSignals(matrix: OntologyMatrix): Signal[] {
  const signals: Signal[] = [];

  for (const docRef of matrix.docsReferences) {
    const absoluteDocPath = path.join(REPO_ROOT, docRef.path);
    if (!fs.existsSync(absoluteDocPath)) {
      continue;
    }
    signals.push({
      source: 'docs',
      target: docRef.path,
      content: normalize(fs.readFileSync(absoluteDocPath, 'utf-8')),
    });
  }

  signals.push({
    source: 'pricing',
    target: 'pricingTiers',
    content: normalize(matrix.pricingTiers.join(' | ')),
  });

  const navLabels: string[] = [];
  for (const experience of EXPERIENCES) {
    const navigation = getNavigationForExperience(experience);
    for (const item of navigation) {
      navLabels.push(item.label);
      if (item.group) {
        navLabels.push(item.group);
      }
    }
  }

  signals.push({
    source: 'navLabels',
    target: 'role-experience-navigation',
    content: normalize(navLabels.join(' | ')),
  });

  signals.push({
    source: 'procurement',
    target: 'docsReferences-procurement-scan',
    content: normalize(
      matrix.docsReferences
        .map((entry) => entry.path)
        .filter((entry) => entry.includes('procurement') || entry.includes('monetization'))
        .join(' | '),
    ),
  });

  return signals;
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
  const warnings: string[] = [];

  for (const rule of policy.rules) {
    const phrase = normalize(rule.phrase.trim());
    if (!phrase) {
      continue;
    }

    const applicableSignals = signals.filter((signal) => rule.appliesTo.includes(signal.source));
    for (const signal of applicableSignals) {
      if (signal.content.includes(phrase)) {
        warnings.push(
          `[${rule.severity}|${rule.classification}|phase-${rule.enforcementPhase}] ${rule.id} matched in ${signal.source}:${signal.target} for phrase "${rule.phrase}". ${rule.reason}`,
        );
      }
    }
  }

  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`WARN - ${warning}`);
    }

    if (policy.mode === 'error') {
      fail(`Detected ${warnings.length} anti-pattern matches in error mode.`);
    }

    console.log(`OK - ontology anti-pattern scan completed in warn mode (${warnings.length} warnings).`);
    return;
  }

  console.log('OK - ontology anti-pattern scan found no matches.');
}

main();
