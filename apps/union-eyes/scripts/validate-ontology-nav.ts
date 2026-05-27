#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import {
  canAccessDashboardPath,
  getNavigationForExperience,
  type DashboardExperience,
} from '../lib/dashboard/role-experience';

type GatingPolicyEntry = {
  domain: string;
  allowedExperiences: DashboardExperience[];
  routePrefixes: string[];
};

type NavCompositionPolicy = {
  ignoredGroups: string[];
  domainAliases: Record<string, string>;
};

type OntologyMatrix = {
  version: string;
  gatingPolicy: GatingPolicyEntry[];
  navComposition: NavCompositionPolicy;
};

const MATRIX_FILE = path.join(__dirname, '../config/continuity-ontology-matrix.json');
const EXPERIENCES: DashboardExperience[] = ['member', 'staff', 'executive', 'governance', 'admin'];

function fail(message: string): never {
  console.error(`Ontology nav validation FAILED: ${message}`);
  process.exit(1);
}

function toPath(href: string): string {
  return href.split('?')[0].split('#')[0] || href;
}

function main(): void {
  if (!fs.existsSync(MATRIX_FILE)) {
    fail(`Missing ontology matrix: ${MATRIX_FILE}`);
  }

  const matrix = JSON.parse(fs.readFileSync(MATRIX_FILE, 'utf-8')) as OntologyMatrix;
  if (!matrix.navComposition || !matrix.navComposition.domainAliases) {
    fail('navComposition policy is missing from ontology matrix.');
  }
  if (!Array.isArray(matrix.gatingPolicy) || matrix.gatingPolicy.length === 0) {
    fail('gatingPolicy is missing from ontology matrix.');
  }

  const ignoredGroups = new Set(matrix.navComposition.ignoredGroups ?? []);
  const aliasToDomain = matrix.navComposition.domainAliases;
  const policyByDomain = new Map(matrix.gatingPolicy.map((policy) => [policy.domain, policy]));

  for (const experience of EXPERIENCES) {
    const navItems = getNavigationForExperience(experience);
    for (const item of navItems) {
      const pathname = toPath(item.href);
      if (!pathname.startsWith('/dashboard')) {
        continue;
      }

      if (!canAccessDashboardPath(pathname, experience, false)) {
        fail(
          `Experience ${experience} navigation item ${item.label} points to ${pathname}, but role-access policy denies this path.`,
        );
      }

      if (!item.group || ignoredGroups.has(item.group)) {
        continue;
      }

      const domain = aliasToDomain[item.group];
      if (!domain) {
        fail(`Navigation group ${item.group} is not mapped in navComposition.domainAliases.`);
      }

      const policy = policyByDomain.get(domain);
      if (!policy) {
        fail(`Navigation group ${item.group} maps to domain ${domain}, but no gatingPolicy domain exists.`);
      }

      if (!policy.allowedExperiences.includes(experience)) {
        fail(
          `Navigation group ${item.group} maps to domain ${domain}, but experience ${experience} is not allowed in gatingPolicy.`,
        );
      }
    }
  }

  console.log('OK - ontology nav composition validated against role navigation and doctrine-derived gating policy.');
}

main();
