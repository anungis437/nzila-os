/**
 * Nzila OS — Tier 2 Fail-Closed Runtime Gate
 *
 * Doctrine anchor: docs/nzila-tier2-hardening/full-fail-closed-runtime-architecture.md
 *
 * The gate inspects every runtime contract that governs whether the runtime
 * is institutionally entitled to serve traffic. Under
 * `RUNTIME_FAIL_CLOSED=true`, missing required contracts refuse boot via
 * `RuntimeContractError`. Otherwise, an explicit degradation banner is
 * emitted and the assessment is returned for callers to render.
 *
 * The contracts table is enumerated, not pluggable.  Adding a contract is
 * an authorized doctrine amendment.
 */

import { logger as appLogger } from '../logger';

export type ContractKey =
  | 'auth.next.secret'
  | 'auth.django.secret'
  | 'auth.webhook.secret'
  | 'crypto.fallback'
  | 'crypto.pii'
  | 'identity.entra.client_id'
  | 'identity.entra.tenant_id'
  | 'identity.entra.client_secret'
  | 'data.database_url'
  | 'lineage.secret_topology'
  | 'lineage.secret_authority'
  | 'lineage.environment_isolation';

export type ContractDisposition =
  | 'fail-closed-governance'
  | 'bounded-runtime'
  | 'continuity-safe-fallback'
  | 'explicit-degradation';

export interface ContractAssessment {
  key: ContractKey;
  envVar: string;
  required: boolean;
  satisfied: boolean;
  disposition: ContractDisposition;
  message: string;
}

export interface FailClosedReport {
  failClosedEnabled: boolean;
  satisfiedAll: boolean;
  unmetRequired: ContractAssessment[];
  unmetOptional: ContractAssessment[];
  contracts: ContractAssessment[];
  banner: string;
}

interface ContractDef {
  key: ContractKey;
  envVar: string;
  required: boolean;
  disposition: ContractDisposition;
}

const CONTRACTS: ReadonlyArray<ContractDef> = [
  { key: 'auth.next.secret', envVar: 'AUTH_SECRET', required: true, disposition: 'fail-closed-governance' },
  { key: 'auth.django.secret', envVar: 'DJANGO_SECRET_KEY', required: true, disposition: 'fail-closed-governance' },
  { key: 'auth.webhook.secret', envVar: 'AUTH_WEBHOOK_SECRET', required: false, disposition: 'bounded-runtime' },
  { key: 'crypto.fallback', envVar: 'FALLBACK_ENCRYPTION_KEY', required: true, disposition: 'fail-closed-governance' },
  { key: 'crypto.pii', envVar: 'EVIDENCE_SEAL_KEY', required: false, disposition: 'bounded-runtime' },
  { key: 'identity.entra.client_id', envVar: 'AZURE_AD_CLIENT_ID', required: false, disposition: 'continuity-safe-fallback' },
  { key: 'identity.entra.tenant_id', envVar: 'AZURE_AD_TENANT_ID', required: false, disposition: 'continuity-safe-fallback' },
  { key: 'identity.entra.client_secret', envVar: 'AZURE_AD_CLIENT_SECRET', required: false, disposition: 'continuity-safe-fallback' },
  { key: 'data.database_url', envVar: 'DATABASE_URL', required: true, disposition: 'fail-closed-governance' },
  { key: 'lineage.secret_topology', envVar: 'SECRET_TOPOLOGY', required: false, disposition: 'explicit-degradation' },
  { key: 'lineage.secret_authority', envVar: 'SECRET_AUTHORITY', required: false, disposition: 'explicit-degradation' },
  { key: 'lineage.environment_isolation', envVar: 'ENVIRONMENT_ISOLATION', required: false, disposition: 'explicit-degradation' },
];

function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return undefined;
  const trimmed = String(raw).trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function describeMissing(def: ContractDef): string {
  switch (def.disposition) {
    case 'fail-closed-governance':
      return `${def.key}: missing ${def.envVar} → fail-closed governance (boot refused under RUNTIME_FAIL_CLOSED=true)`;
    case 'bounded-runtime':
      return `${def.key}: missing ${def.envVar} → bounded runtime (related surface disabled)`;
    case 'continuity-safe-fallback':
      return `${def.key}: missing ${def.envVar} → continuity-safe fallback (Entra path disabled)`;
    case 'explicit-degradation':
      return `${def.key}: missing ${def.envVar} → explicit degradation (lineage banner)`;
  }
}

export function assessRuntimeContracts(): FailClosedReport {
  const failClosedEnabled = (readEnv('RUNTIME_FAIL_CLOSED') ?? '').toLowerCase() === 'true';

  const contracts: ContractAssessment[] = CONTRACTS.map((def) => {
    const value = readEnv(def.envVar);
    const satisfied = value !== undefined;
    return {
      key: def.key,
      envVar: def.envVar,
      required: def.required,
      satisfied,
      disposition: def.disposition,
      message: satisfied ? `${def.key}: ${def.envVar} present` : describeMissing(def),
    };
  });

  const unmetRequired = contracts.filter((c) => c.required && !c.satisfied);
  const unmetOptional = contracts.filter((c) => !c.required && !c.satisfied);
  const satisfiedAll = unmetRequired.length === 0 && unmetOptional.length === 0;

  const lines = [
    `[runtime-fail-closed] mode=${failClosedEnabled ? 'enforced' : 'advisory'} satisfied=${satisfiedAll}`,
  ];
  for (const c of [...unmetRequired, ...unmetOptional]) {
    lines.push(`  - ${c.message}`);
  }
  const banner = lines.join('\n');

  return { failClosedEnabled, satisfiedAll, unmetRequired, unmetOptional, contracts, banner };
}

export class RuntimeContractError extends Error {
  readonly report: FailClosedReport;
  constructor(report: FailClosedReport) {
    const summary = report.unmetRequired.map((c) => c.key).join(', ');
    super(`Runtime contract refused boot — unmet required contracts: ${summary}`);
    this.name = 'RuntimeContractError';
    this.report = report;
  }
}

export interface EnforceLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

const defaultLogger: EnforceLogger = {
  info: (m) => appLogger.info(m),
  warn: (m) => appLogger.warn(m),
  error: (m) => appLogger.error(m),
};

export function enforceRuntimeFailClosed(logger: EnforceLogger = defaultLogger): FailClosedReport {
  const report = assessRuntimeContracts();

  if (report.failClosedEnabled && report.unmetRequired.length > 0) {
    logger.error(report.banner);
    throw new RuntimeContractError(report);
  }

  if (report.unmetRequired.length > 0 || report.unmetOptional.length > 0) {
    logger.warn(report.banner);
  } else {
    logger.info(report.banner);
  }

  return report;
}
