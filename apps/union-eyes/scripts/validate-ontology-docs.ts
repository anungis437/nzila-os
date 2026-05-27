#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

type DocReference = {
  path: string;
  requiredTerms: string[];
};

type OntologyMatrix = {
  version: string;
  docsReferences: DocReference[];
};

const MATRIX_FILE = path.join(__dirname, '../config/continuity-ontology-matrix.json');
const REPO_ROOT = path.resolve(__dirname, '../../..');

function fail(message: string): never {
  console.error(`Ontology docs validation FAILED: ${message}`);
  process.exit(1);
}

function main(): void {
  if (!fs.existsSync(MATRIX_FILE)) {
    fail(`Missing ontology matrix: ${MATRIX_FILE}`);
  }

  const matrix = JSON.parse(fs.readFileSync(MATRIX_FILE, 'utf-8')) as OntologyMatrix;
  if (!Array.isArray(matrix.docsReferences) || matrix.docsReferences.length === 0) {
    fail('docsReferences is missing or empty in ontology matrix.');
  }

  for (const docRef of matrix.docsReferences) {
    const absoluteDocPath = path.join(REPO_ROOT, docRef.path);
    if (!fs.existsSync(absoluteDocPath)) {
      fail(`Referenced doc does not exist: ${docRef.path}`);
    }

    const content = fs.readFileSync(absoluteDocPath, 'utf-8').toLowerCase();
    for (const term of docRef.requiredTerms) {
      if (!content.includes(term.toLowerCase())) {
        fail(`Doc ${docRef.path} is missing required term: ${term}`);
      }
    }
  }

  console.log(`OK - ontology docs validated (${matrix.docsReferences.length} references checked).`);
}

main();
