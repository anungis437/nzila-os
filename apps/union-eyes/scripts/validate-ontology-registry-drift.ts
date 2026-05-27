#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

type OntologyLayer = {
  layer: string;
  canonicalApis: string[];
  runtimeApis: string[];
};

type OntologyMatrix = {
  version: string;
  layers: OntologyLayer[];
};

type RegistryRoute = {
  routePath: string;
};

type RouteRegistry = {
  generatedAt: string;
  routes: RegistryRoute[];
};

const MATRIX_FILE = path.join(__dirname, '../config/continuity-ontology-matrix.json');
const REGISTRY_FILE = path.join(__dirname, '../reports/route-registry.json');

function fail(message: string): never {
  console.error(`Ontology registry drift validation FAILED: ${message}`);
  process.exit(1);
}

function main(): void {
  if (!fs.existsSync(MATRIX_FILE)) {
    fail(`Missing ontology matrix: ${MATRIX_FILE}`);
  }

  if (!fs.existsSync(REGISTRY_FILE)) {
    fail(`Missing route registry: ${REGISTRY_FILE}. Run pnpm --filter @nzila/union-eyes registry:generate first.`);
  }

  const matrix = JSON.parse(fs.readFileSync(MATRIX_FILE, 'utf-8')) as OntologyMatrix;
  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8')) as RouteRegistry;

  if (!Array.isArray(matrix.layers) || matrix.layers.length === 0) {
    fail('Ontology matrix contains no layers.');
  }

  if (!Array.isArray(registry.routes) || registry.routes.length === 0) {
    fail('Route registry contains no routes.');
  }

  const registryPaths = new Set(registry.routes.map((route) => route.routePath));
  const missingCanonicalApis: string[] = [];
  const missingRuntimeApis: string[] = [];

  for (const layer of matrix.layers) {
    for (const canonicalApi of layer.canonicalApis) {
      if (!registryPaths.has(canonicalApi)) {
        missingCanonicalApis.push(`${layer.layer}: ${canonicalApi}`);
      }
    }

    for (const runtimeApi of layer.runtimeApis) {
      if (!registryPaths.has(runtimeApi)) {
        missingRuntimeApis.push(`${layer.layer}: ${runtimeApi}`);
      }
    }
  }

  if (missingCanonicalApis.length > 0 || missingRuntimeApis.length > 0) {
    const canonicalBlock = missingCanonicalApis.length
      ? `Missing canonical APIs:\n  - ${missingCanonicalApis.join('\n  - ')}`
      : '';
    const runtimeBlock = missingRuntimeApis.length
      ? `Missing runtime APIs:\n  - ${missingRuntimeApis.join('\n  - ')}`
      : '';

    fail([canonicalBlock, runtimeBlock].filter(Boolean).join('\n'));
  }

  console.log(
    `OK - ontology matrix ${matrix.version} matches live route registry (${registry.routes.length} API routes, generated ${registry.generatedAt}).`,
  );
}

main();
