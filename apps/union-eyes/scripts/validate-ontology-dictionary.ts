#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

type SemanticDictionaryEntry = {
  term: string;
  canonicalLabel: string;
  definition: string;
  synonyms: string[];
};

type OntologyMatrix = {
  version: string;
  semanticDictionaryDoc: string;
  semanticDictionary: SemanticDictionaryEntry[];
};

const MATRIX_FILE = path.join(__dirname, '../config/continuity-ontology-matrix.json');
const REPO_ROOT = path.resolve(__dirname, '../../..');

function fail(message: string): never {
  console.error(`Ontology dictionary validation FAILED: ${message}`);
  process.exit(1);
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function main(): void {
  if (!fs.existsSync(MATRIX_FILE)) {
    fail(`Missing ontology matrix: ${MATRIX_FILE}`);
  }

  const matrix = JSON.parse(fs.readFileSync(MATRIX_FILE, 'utf-8')) as OntologyMatrix;

  if (!Array.isArray(matrix.semanticDictionary) || matrix.semanticDictionary.length === 0) {
    fail('semanticDictionary is missing or empty.');
  }

  if (!matrix.semanticDictionaryDoc?.trim()) {
    fail('semanticDictionaryDoc is missing.');
  }

  const glossaryPath = path.join(REPO_ROOT, matrix.semanticDictionaryDoc);
  if (!fs.existsSync(glossaryPath)) {
    fail(`semanticDictionaryDoc does not exist: ${matrix.semanticDictionaryDoc}`);
  }

  const glossaryContent = fs.readFileSync(glossaryPath, 'utf-8').toLowerCase();
  const termSet = new Set<string>();

  for (const entry of matrix.semanticDictionary) {
    if (!entry.term?.trim()) {
      fail('semanticDictionary entry contains an empty term.');
    }
    if (!entry.canonicalLabel?.trim()) {
      fail(`semanticDictionary term ${entry.term} is missing canonicalLabel.`);
    }
    if (!entry.definition?.trim()) {
      fail(`semanticDictionary term ${entry.term} is missing definition.`);
    }
    if (entry.definition.trim().length < 40) {
      fail(`semanticDictionary term ${entry.term} definition is too short for constitutional semantics.`);
    }

    const normalizedTerm = normalize(entry.term);
    if (termSet.has(normalizedTerm)) {
      fail(`Duplicate semanticDictionary term: ${entry.term}`);
    }
    termSet.add(normalizedTerm);

    if (!Array.isArray(entry.synonyms) || entry.synonyms.length === 0) {
      fail(`semanticDictionary term ${entry.term} must include at least one synonym.`);
    }

    const normalizedSynonyms = new Set<string>();
    for (const synonym of entry.synonyms) {
      if (!synonym?.trim()) {
        fail(`semanticDictionary term ${entry.term} has an empty synonym.`);
      }
      const normalizedSynonym = normalize(synonym);
      if (normalizedSynonym === normalizedTerm) {
        fail(`semanticDictionary term ${entry.term} includes a synonym identical to the term.`);
      }
      if (normalizedSynonyms.has(normalizedSynonym)) {
        fail(`semanticDictionary term ${entry.term} includes duplicate synonym: ${synonym}`);
      }
      normalizedSynonyms.add(normalizedSynonym);
    }

    if (!glossaryContent.includes(entry.canonicalLabel.toLowerCase())) {
      fail(
        `semanticDictionary canonicalLabel ${entry.canonicalLabel} is not present in ${matrix.semanticDictionaryDoc}.`,
      );
    }
  }

  console.log(
    `OK - ontology semantic dictionary validated (${matrix.semanticDictionary.length} canonical terms).`,
  );
}

main();
