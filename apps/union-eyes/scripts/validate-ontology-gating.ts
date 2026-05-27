#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { getAllowedPrefixesByExperience, type DashboardExperience } from '../lib/dashboard/role-experience';

type GatingPolicyEntry = {
  domain: string;
  allowedExperiences: DashboardExperience[];
  routePrefixes: string[];
};

type OntologyMatrix = {
  version: string;
  gatingPolicy: GatingPolicyEntry[];
};

const MATRIX_FILE = path.join(__dirname, '../config/continuity-ontology-matrix.json');

const VALID_EXPERIENCES: DashboardExperience[] = ['member', 'staff', 'executive', 'governance', 'admin'];

function fail(message: string): never {
  console.error(`Ontology gating validation FAILED: ${message}`);
  process.exit(1);
}

function includesPrefix(allowed: string[], prefix: string): boolean {
  return allowed.some((entry) => prefix === entry || prefix.startsWith(`${entry}/`) || entry.startsWith(`${prefix}/`));
}

function main(): void {
  if (!fs.existsSync(MATRIX_FILE)) {
    fail(`Missing ontology matrix: ${MATRIX_FILE}`);
  }

  const matrix = JSON.parse(fs.readFileSync(MATRIX_FILE, 'utf-8')) as OntologyMatrix;
  if (!Array.isArray(matrix.gatingPolicy) || matrix.gatingPolicy.length === 0) {
    fail('Matrix gatingPolicy is missing or empty.');
  }

  const allowedPrefixesByExperience = getAllowedPrefixesByExperience();
  const domainSet = new Set<string>();

  for (const policy of matrix.gatingPolicy) {
    if (!policy.domain?.trim()) {
      fail('A gatingPolicy entry has an empty domain.');
    }
    if (domainSet.has(policy.domain)) {
      fail(`Duplicate gatingPolicy domain: ${policy.domain}`);
    }
    domainSet.add(policy.domain);

    if (!Array.isArray(policy.allowedExperiences) || policy.allowedExperiences.length === 0) {
      fail(`Domain ${policy.domain} has no allowed experiences.`);
    }

    for (const experience of policy.allowedExperiences) {
      if (!VALID_EXPERIENCES.includes(experience)) {
        fail(`Domain ${policy.domain} has unknown experience: ${String(experience)}`);
      }
      const allowedPrefixes = allowedPrefixesByExperience[experience] ?? [];
      for (const domainPrefix of policy.routePrefixes) {
        if (!includesPrefix(allowedPrefixes, domainPrefix)) {
          fail(
            `Domain ${policy.domain} prefix ${domainPrefix} is not reachable for experience ${experience} per role-experience allowlist.`,
          );
        }
      }
    }
  }

  console.log(
    `OK - ontology gating validated for ${matrix.gatingPolicy.length} domains across ${VALID_EXPERIENCES.length} dashboard experiences.`,
  );
}

main();
