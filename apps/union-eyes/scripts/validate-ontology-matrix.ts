#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

type OntologyLayer = {
  layer: string;
  canonicalRoutes: string[];
  runtimeRoutes: string[];
  canonicalApis: string[];
  navLabels: string[];
  runtimeApis: string[];
};

type DocReference = {
  path: string;
  requiredTerms: string[];
};

type GatingPolicyEntry = {
  domain: string;
  allowedExperiences: string[];
  routePrefixes: string[];
};

type SemanticDictionaryEntry = {
  term: string;
  canonicalLabel: string;
  definition: string;
  synonyms: string[];
};

type NavCompositionPolicy = {
  ignoredGroups: string[];
  domainAliases: Record<string, string>;
};

type ConstitutionPolicy = {
  version: string;
  status: string;
  effectiveDate: string;
  frozenDomains: string[];
  amendmentPolicy: string;
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

type AntiPatternIntelligence = {
  mode: 'warn' | 'error';
  calibrationClasses: string[];
  rules: AntiPatternRule[];
};

type OntologyMatrix = {
  version: string;
  lastUpdated: string;
  governanceDomains: string[];
  layers: OntologyLayer[];
  pricingTiers: string[];
  featureGates: string[];
  docsReferences: DocReference[];
  gatingPolicy: GatingPolicyEntry[];
  semanticDictionaryDoc: string;
  semanticDictionary: SemanticDictionaryEntry[];
  navComposition: NavCompositionPolicy;
  constitution: ConstitutionPolicy;
  antiPatternIntelligence: AntiPatternIntelligence;
};

const MATRIX_FILE = path.join(__dirname, '../config/continuity-ontology-matrix.json');

const REQUIRED_LAYERS = [
  'OCI Foundations',
  'OCRA Intelligence',
  'Operations Core',
  'Governance Continuity',
  'Institutional Intelligence',
];

const REQUIRED_GOVERNANCE_DOMAINS = [
  'routes',
  'apis',
  'navLabels',
  'featureGates',
  'pricingTiers',
  'docsReferences',
  'procurementLanguage',
  'visibilityRules',
  'semanticDictionary',
  'navComposition',
  'antiPatternIntelligence',
  'constitutionalAmendments',
];

const REQUIRED_ALIAS_FILES = [
  '../app/[locale]/oci/page.tsx',
  '../app/[locale]/ocra/page.tsx',
  '../app/[locale]/operations/grievances/page.tsx',
  '../app/[locale]/operations/investigations/page.tsx',
  '../app/[locale]/continuity/docs/page.tsx',
  '../app/[locale]/continuity/inheritance/page.tsx',
  '../app/[locale]/continuity/archives/page.tsx',
  '../app/[locale]/onboarding/page.tsx',
  '../app/[locale]/onboarding/survivability/page.tsx',
  '../app/[locale]/onboarding/transfers/page.tsx',
  '../app/[locale]/governance-continuity/page.tsx',
  '../app/api/oci/intake/route.ts',
  '../app/api/oci/assessment/route.ts',
  '../app/api/oci/results/[id]/route.ts',
  '../app/api/oci/report/[assessmentId]/route.ts',
  '../app/api/investigations/route.ts',
  '../app/api/investigations/evidence/route.ts',
  '../app/api/investigations/timeline/route.ts',
  '../app/api/investigations/audit/route.ts',
  '../app/api/continuity/docs/route.ts',
  '../app/api/continuity/inheritance/route.ts',
  '../app/api/continuity/archives/route.ts',
  '../app/api/onboarding/transfers/route.ts',
  '../app/api/onboarding/readiness/route.ts',
  '../app/api/governance/route.ts',
  '../app/api/intelligence/route.ts',
];

function fail(message: string): never {
  console.error(`Ontology matrix validation FAILED: ${message}`);
  process.exit(1);
}

function validateLayerShape(layer: OntologyLayer): void {
  if (!layer.layer || !layer.layer.trim()) {
    fail('Encountered a layer entry with an empty layer name.');
  }

  if (!Array.isArray(layer.canonicalRoutes) || layer.canonicalRoutes.length === 0) {
    fail(`Layer "${layer.layer}" must declare at least one canonical route.`);
  }

  if (!Array.isArray(layer.runtimeRoutes) || layer.runtimeRoutes.length === 0) {
    fail(`Layer "${layer.layer}" must declare at least one runtime route.`);
  }

  if (!Array.isArray(layer.canonicalApis) || layer.canonicalApis.length === 0) {
    fail(`Layer "${layer.layer}" must declare at least one canonical API.`);
  }

  if (!Array.isArray(layer.navLabels) || layer.navLabels.length === 0) {
    fail(`Layer "${layer.layer}" must declare at least one nav label.`);
  }

  if (!Array.isArray(layer.runtimeApis) || layer.runtimeApis.length === 0) {
    fail(`Layer "${layer.layer}" must declare at least one runtime API.`);
  }
}

function main(): void {
  if (!fs.existsSync(MATRIX_FILE)) {
    fail(`Missing matrix file: ${MATRIX_FILE}`);
  }

  const parsed = JSON.parse(fs.readFileSync(MATRIX_FILE, 'utf-8')) as OntologyMatrix;

  if (!parsed.version || !parsed.lastUpdated) {
    fail('Matrix must include version and lastUpdated metadata.');
  }

  if (!Array.isArray(parsed.governanceDomains) || parsed.governanceDomains.length === 0) {
    fail('Matrix must include governanceDomains.');
  }

  for (const domain of REQUIRED_GOVERNANCE_DOMAINS) {
    if (!parsed.governanceDomains.includes(domain)) {
      fail(`Required governance domain missing from matrix: ${domain}`);
    }
  }

  if (!Array.isArray(parsed.layers) || parsed.layers.length === 0) {
    fail('Matrix must include a non-empty layers array.');
  }

  if (!Array.isArray(parsed.pricingTiers) || parsed.pricingTiers.length < 4) {
    fail('Matrix must include pricingTiers with at least four maturity tiers.');
  }

  if (!Array.isArray(parsed.featureGates) || parsed.featureGates.length === 0) {
    fail('Matrix must include featureGates.');
  }

  if (!Array.isArray(parsed.docsReferences) || parsed.docsReferences.length === 0) {
    fail('Matrix must include docsReferences.');
  }

  for (const docRef of parsed.docsReferences) {
    if (!docRef.path || !docRef.path.trim()) {
      fail('Each docsReferences entry must include a non-empty path.');
    }
    if (!Array.isArray(docRef.requiredTerms) || docRef.requiredTerms.length === 0) {
      fail(`docsReferences entry ${docRef.path} must include requiredTerms.`);
    }
  }

  if (!Array.isArray(parsed.gatingPolicy) || parsed.gatingPolicy.length === 0) {
    fail('Matrix must include gatingPolicy.');
  }

  for (const policy of parsed.gatingPolicy) {
    if (!policy.domain || !policy.domain.trim()) {
      fail('Each gatingPolicy entry must include a domain.');
    }
    if (!Array.isArray(policy.allowedExperiences) || policy.allowedExperiences.length === 0) {
      fail(`gatingPolicy entry ${policy.domain} must include allowedExperiences.`);
    }
    if (!Array.isArray(policy.routePrefixes) || policy.routePrefixes.length === 0) {
      fail(`gatingPolicy entry ${policy.domain} must include routePrefixes.`);
    }
  }

  if (!parsed.semanticDictionaryDoc || !parsed.semanticDictionaryDoc.trim()) {
    fail('Matrix must include semanticDictionaryDoc.');
  }

  if (!Array.isArray(parsed.semanticDictionary) || parsed.semanticDictionary.length === 0) {
    fail('Matrix must include semanticDictionary.');
  }

  for (const entry of parsed.semanticDictionary) {
    if (!entry.term || !entry.term.trim()) {
      fail('Each semanticDictionary entry must include term.');
    }
    if (!entry.canonicalLabel || !entry.canonicalLabel.trim()) {
      fail(`semanticDictionary entry ${entry.term} must include canonicalLabel.`);
    }
    if (!entry.definition || !entry.definition.trim()) {
      fail(`semanticDictionary entry ${entry.term} must include definition.`);
    }
    if (!Array.isArray(entry.synonyms) || entry.synonyms.length === 0) {
      fail(`semanticDictionary entry ${entry.term} must include synonyms.`);
    }
  }

  if (!parsed.navComposition) {
    fail('Matrix must include navComposition.');
  }

  if (!Array.isArray(parsed.navComposition.ignoredGroups)) {
    fail('navComposition must include ignoredGroups array.');
  }

  if (!parsed.navComposition.domainAliases || Object.keys(parsed.navComposition.domainAliases).length === 0) {
    fail('navComposition must include non-empty domainAliases map.');
  }

  if (!parsed.constitution) {
    fail('Matrix must include constitution policy.');
  }

  if (!parsed.constitution.version || !parsed.constitution.status || !parsed.constitution.effectiveDate) {
    fail('constitution must include version, status, and effectiveDate.');
  }

  if (!Array.isArray(parsed.constitution.frozenDomains) || parsed.constitution.frozenDomains.length === 0) {
    fail('constitution must include frozenDomains.');
  }

  if (!parsed.constitution.amendmentPolicy || !parsed.constitution.amendmentPolicy.trim()) {
    fail('constitution must include amendmentPolicy.');
  }

  if (!parsed.antiPatternIntelligence) {
    fail('Matrix must include antiPatternIntelligence policy.');
  }

  if (!['warn', 'error'].includes(parsed.antiPatternIntelligence.mode)) {
    fail('antiPatternIntelligence.mode must be warn or error.');
  }

  if (
    !Array.isArray(parsed.antiPatternIntelligence.calibrationClasses)
    || parsed.antiPatternIntelligence.calibrationClasses.length === 0
  ) {
    fail('antiPatternIntelligence must include calibrationClasses.');
  }

  const calibrationClasses = new Set(parsed.antiPatternIntelligence.calibrationClasses);

  if (!Array.isArray(parsed.antiPatternIntelligence.rules) || parsed.antiPatternIntelligence.rules.length === 0) {
    fail('antiPatternIntelligence must include rules.');
  }

  for (const rule of parsed.antiPatternIntelligence.rules) {
    if (!rule.id || !rule.id.trim()) {
      fail('antiPatternIntelligence rule must include id.');
    }
    if (!rule.phrase || !rule.phrase.trim()) {
      fail(`antiPatternIntelligence rule ${rule.id} must include phrase.`);
    }
    if (!rule.classification || !rule.classification.trim()) {
      fail(`antiPatternIntelligence rule ${rule.id} must include classification.`);
    }
    if (!calibrationClasses.has(rule.classification)) {
      fail(
        `antiPatternIntelligence rule ${rule.id} classification ${rule.classification} is not in calibrationClasses.`,
      );
    }
    if (!rule.severity || !rule.severity.trim()) {
      fail(`antiPatternIntelligence rule ${rule.id} must include severity.`);
    }
    if (!['A', 'B', 'C', 'D'].includes(rule.enforcementPhase)) {
      fail(`antiPatternIntelligence rule ${rule.id} must include enforcementPhase A, B, C, or D.`);
    }
    if (!rule.reason || !rule.reason.trim()) {
      fail(`antiPatternIntelligence rule ${rule.id} must include reason.`);
    }
    if (!Array.isArray(rule.appliesTo) || rule.appliesTo.length === 0) {
      fail(`antiPatternIntelligence rule ${rule.id} must include appliesTo.`);
    }
  }

  const layerNames = new Set(parsed.layers.map((layer) => layer.layer));
  for (const requiredLayer of REQUIRED_LAYERS) {
    if (!layerNames.has(requiredLayer)) {
      fail(`Required layer missing from matrix: ${requiredLayer}`);
    }
  }

  for (const layer of parsed.layers) {
    validateLayerShape(layer);
  }

  for (const relativeFile of REQUIRED_ALIAS_FILES) {
    const absoluteFile = path.join(__dirname, relativeFile);
    if (!fs.existsSync(absoluteFile)) {
      fail(`Required alias file missing: ${relativeFile}`);
    }
  }

  console.log(
    `OK - ontology matrix ${parsed.version} validated (${parsed.layers.length} layers, ${REQUIRED_ALIAS_FILES.length} alias files).`,
  );
}

main();
