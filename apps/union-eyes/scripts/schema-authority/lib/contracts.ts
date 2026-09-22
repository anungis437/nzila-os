/**
 * Loaders + types for the executable schema-contract artifacts.
 * DB-free. Used by the verifier, the lint, and their tests.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CanonicalSchema } from './normalize';

const here = path.dirname(fileURLToPath(import.meta.url));
// scripts/schema-authority/lib -> apps/union-eyes
export const APP_ROOT = path.resolve(here, '..', '..', '..');
export const SCHEMA_AUTHORITY_DIR = path.join(APP_ROOT, 'db', 'schema-authority');
export const GENERATED_DIR = path.join(SCHEMA_AUTHORITY_DIR, 'generated');

export const REGISTRY_PATH = path.join(SCHEMA_AUTHORITY_DIR, 'registry.json');
export const REQUIRED_CONTRACT_PATH = path.join(SCHEMA_AUTHORITY_DIR, 'runtime-required-contract.json');
export const DISPOSITIONS_PATH = path.join(SCHEMA_AUTHORITY_DIR, 'runtime-drift-dispositions.json');
export const CANONICAL_SCHEMA_PATH = path.join(GENERATED_DIR, 'canonical-schema.json');
export const CANONICAL_SCHEMA_SHA_PATH = path.join(GENERATED_DIR, 'canonical-schema.sha256');

export type OwnerKind = 'DJANGO_CANONICAL' | 'DRIZZLE_SCOPED' | 'PLATFORM_AUTH' | 'EXTERNAL_READONLY';

export interface RegistryTable {
  table: string;
  owner: OwnerKind;
  djangoApp?: string | null;
  djangoModel?: string | null;
  rlsRequired?: boolean;
  canonical43?: boolean;
  [k: string]: unknown;
}

export interface Registry {
  version: number;
  tables: RegistryTable[];
  computed: Record<string, unknown>;
  [k: string]: unknown;
}

export type RequiredUsage =
  | 'DIRECTLY_CONSUMED'
  | 'AUTHORITY_SEMANTIC'
  | 'WRITE_REQUIRED'
  | 'FILTER_REQUIRED'
  | 'JOIN_REQUIRED'
  | 'ORDER_REQUIRED';

export interface RequiredEntry {
  schema: string;
  table: string;
  column: string;
  owner: OwnerKind;
  requirement: 'REQUIRED_NOW';
  usage: RequiredUsage;
  access: 'READ' | 'WRITE';
  requiredType?: string;
  wave1_acceptance_ids?: string[];
  source_paths?: string[];
  reason?: string;
}

export interface RequiredContract {
  version: number;
  entries: RequiredEntry[];
  [k: string]: unknown;
}

export type DispositionClass =
  | 'STALE_RUNTIME_ASSUMPTION'
  | 'INCIDENTAL_ONLY'
  | 'NON_RUNTIME_ORM_DRIFT'
  | 'NOT_IMPLEMENTED'
  | 'NON_BLOCKING_SEMANTIC'
  | 'SECURITY_SENSITIVE_DO_NOT_RESTORE';

export interface Disposition {
  schema: string;
  table: string;
  column: string;
  class: DispositionClass;
  requiredNow: false;
  action?: string;
  reason?: string;
}

export interface Dispositions {
  version: number;
  dispositions: Disposition[];
  [k: string]: unknown;
}

export interface CanonicalSchemaFile {
  meta: Record<string, unknown>;
  digest: string;
  schemas: CanonicalSchema[];
}

function readJson<T>(p: string): T {
  if (!fs.existsSync(p)) {
    throw new Error(`Required artifact missing: ${p}`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

export const loadRegistry = (p: string = REGISTRY_PATH): Registry => readJson<Registry>(p);
export const loadRequiredContract = (p: string = REQUIRED_CONTRACT_PATH): RequiredContract =>
  readJson<RequiredContract>(p);
export const loadDispositions = (p: string = DISPOSITIONS_PATH): Dispositions =>
  readJson<Dispositions>(p);
export const loadCanonicalSchema = (p: string = CANONICAL_SCHEMA_PATH): CanonicalSchemaFile =>
  readJson<CanonicalSchemaFile>(p);

export const key = (schema: string, table: string, column?: string): string =>
  column ? `${schema}.${table}.${column}` : `${schema}.${table}`;
