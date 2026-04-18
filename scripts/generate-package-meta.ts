/**
 * Generates package.meta.json for all packages under packages/.
 * Run once: tsx scripts/generate-package-meta.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const PACKAGES_DIR = path.join(ROOT, 'packages')

interface PackageMeta {
  owner: string
  category: string
  stability: string
  allowed_dependents: string[]
  forbidden_dependents: string[]
  replacement_for: string | null
  deprecated: boolean
  deprecation_note: string | null
}

const DEFAULT_META: PackageMeta = {
  owner: 'platform',
  category: 'DOMAIN_SHARED',
  stability: 'EVOLVING',
  allowed_dependents: ['apps/*', 'packages/*'],
  forbidden_dependents: [],
  replacement_for: null,
  deprecated: false,
  deprecation_note: null,
}

const META: Record<string, PackageMeta> = {
  // ── Platform Core ─────────────────────────────────
  'os-core':        { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'db':             { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'config':         { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'org':            { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'blob':           { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'ui':             { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'otel-core':      { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'secrets':        { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'evidence':       { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'tools-runtime':  { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'data-lifecycle': { owner: 'platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'cli':            { owner: 'platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['scripts/*','tooling/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },

  // ── Platform Packages ─────────────────────────────
  'platform-utils':                   { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-policy-engine':           { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-governance':              { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-observability':           { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-events':                  { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-event-fabric':            { owner: 'platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-evidence-pack':           { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-export':                  { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-metrics':                 { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-performance':             { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-isolation':               { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-proof':                   { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-feature-flags':           { owner: 'platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-environment':             { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-deploy':                  { owner: 'platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-change-management':       { owner: 'platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-compliance-snapshots':    { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-procurement-proof':       { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-assurance':               { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-validation':              { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['scripts/*','tooling/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-rfp-generator':           { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/control-plane'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-ops':                     { owner: 'platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','scripts/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-rum':                     { owner: 'platform', category: 'PLATFORM_CORE', stability: 'EXPERIMENTAL', allowed_dependents: ['apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-cost':                    { owner: 'platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/control-plane','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-marketplace':             { owner: 'platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/control-plane','apps/web'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },

  // ── AI / Intelligence ─────────────────────────────
  'ai-core':                          { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['packages/ai-*','packages/platform-ai-*','apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'ai-sdk':                           { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'ai-registry':                      { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['packages/platform-ai-*','apps/control-plane'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'ml-core':                          { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['packages/ml-*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'ml-sdk':                           { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-intelligence':            { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-ai-query':                { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-anomaly-engine':          { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-agent-workflows':         { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-ai-governance':           { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-governed-ai':             { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-reasoning-engine':        { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EXPERIMENTAL', allowed_dependents: ['packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-semantic-search':         { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-context-orchestrator':    { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-knowledge-registry':      { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-decision-engine':         { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-decision-graph':          { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-ontology':                { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-entity-graph':            { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EVOLVING', allowed_dependents: ['packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-data-fabric':             { owner: 'ai-platform', category: 'PLATFORM_CORE', stability: 'EXPERIMENTAL', allowed_dependents: ['packages/platform-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'mobility-ai':                      { owner: 'ai-platform', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/mobility*','packages/mobility-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },

  // ── Commerce Domain ───────────────────────────────
  'commerce-core':              { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['apps/*','packages/commerce-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'commerce-db':                { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['packages/commerce-*','apps/shop-quoter','apps/web'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'commerce-events':            { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['packages/commerce-*','apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'commerce-state':             { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['packages/commerce-*','apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'commerce-services':          { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['apps/*','packages/commerce-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'commerce-audit':             { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['packages/commerce-*','apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'commerce-evidence':          { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['packages/commerce-*','apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'commerce-governance':        { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['packages/commerce-*','apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'commerce-observability':     { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['packages/commerce-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'commerce-integration-tests': { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: [], forbidden_dependents: ['apps/*','packages/*'], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-commerce-org':      { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['apps/*','packages/commerce-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'pricing-engine':             { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['apps/shop-quoter','apps/web','packages/commerce-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'payments-stripe':            { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['apps/*','packages/commerce-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'fx':                         { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['apps/*','packages/commerce-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'tax':                        { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['apps/*','packages/commerce-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'qbo':                        { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/cfo','packages/commerce-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'finops':                     { owner: 'commerce', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/cfo','packages/platform-cost'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },

  // ── Agri Domain ───────────────────────────────────
  'agri-core':          { owner: 'agri', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/agri-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'agri-db':            { owner: 'agri', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['packages/agri-*','apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'agri-events':        { owner: 'agri', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['packages/agri-*','apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'agri-intelligence':  { owner: 'agri', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['packages/agri-*','apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'agri-traceability':  { owner: 'agri', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['packages/agri-*','apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'agri-adapters':      { owner: 'agri', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['packages/agri-*','apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },

  // ── Mobility Domain ───────────────────────────────
  'mobility-core':         { owner: 'mobility', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/mobility*','packages/mobility-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'mobility-programs':     { owner: 'mobility', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/mobility*','packages/mobility-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'mobility-compliance':   { owner: 'mobility', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/mobility*','packages/mobility-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'mobility-family':       { owner: 'mobility', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/mobility*','packages/mobility-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'mobility-case-engine':  { owner: 'mobility', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/mobility*','packages/mobility-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },

  // ── Trade Domain ──────────────────────────────────
  'trade-core':      { owner: 'trade', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/trade','packages/trade-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'trade-db':        { owner: 'trade', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['packages/trade-*','apps/trade'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'trade-cars':      { owner: 'trade', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/trade','packages/trade-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'trade-adapters':  { owner: 'trade', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['packages/trade-*','apps/trade'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },

  // ── Integration Platform ──────────────────────────
  'integrations-core':                     { owner: 'integrations', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['packages/integrations-*','apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'integrations-db':                       { owner: 'integrations', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['packages/integrations-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'integrations-runtime':                  { owner: 'integrations', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'integrations-hubspot':                  { owner: 'integrations', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/integrations-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'integrations-m365':                     { owner: 'integrations', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/integrations-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'integrations-whatsapp':                 { owner: 'integrations', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/integrations-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'platform-integrations-control-plane':   { owner: 'integrations', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/control-plane'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'crm-hubspot':                           { owner: 'integrations', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/integrations-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'webhooks':                              { owner: 'integrations', category: 'PLATFORM_CORE', stability: 'STABLE', allowed_dependents: ['apps/*','packages/integrations-*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },

  // ── Communications ────────────────────────────────
  'comms-email':    { owner: 'comms', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'comms-sms':      { owner: 'comms', category: 'DOMAIN_SHARED', stability: 'STABLE', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'comms-push':     { owner: 'comms', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'chatops-slack':  { owner: 'comms', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'chatops-teams':  { owner: 'comms', category: 'DOMAIN_SHARED', stability: 'EVOLVING', allowed_dependents: ['apps/*','packages/*'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },

  // ── App Support ───────────────────────────────────
  'shop-quoter':  { owner: 'commerce', category: 'APP_SUPPORT', stability: 'STABLE', allowed_dependents: ['apps/shop-quoter'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'nacp-core':    { owner: 'nacp', category: 'APP_SUPPORT', stability: 'EVOLVING', allowed_dependents: ['apps/nacp-exams'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },
  'zonga-core':   { owner: 'zonga', category: 'APP_SUPPORT', stability: 'EVOLVING', allowed_dependents: ['apps/zonga'], forbidden_dependents: [], replacement_for: null, deprecated: false, deprecation_note: null },

  // ── Scaffold / Tooling ────────────────────────────
  'scripts-book': { owner: 'platform', category: 'APP_SUPPORT', stability: 'STABLE', allowed_dependents: [], forbidden_dependents: ['apps/*','packages/*'], replacement_for: null, deprecated: false, deprecation_note: null },
}

let created = 0
let skipped = 0

const dirs = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(PACKAGES_DIR, d.name, 'package.json')))

for (const dir of dirs) {
  const metaPath = path.join(PACKAGES_DIR, dir.name, 'package.meta.json')
  const meta = META[dir.name] ?? DEFAULT_META

  if (!META[dir.name]) {
    process.stderr.write(`⚠  No metadata defined for packages/${dir.name}; applying default metadata\n`)
    skipped++
  }

  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')
  created++
}

process.stdout.write(`\n✓ Created ${created} package.meta.json files (${skipped} skipped)\n`)
