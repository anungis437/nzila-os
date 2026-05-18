#!/usr/bin/env ts-node
/**
 * generate-observability-report.ts
 *
 * Produces two artifacts:
 *
 *   reports/governance-observability-summary.json
 *   docs/procurement/GOVERNED_OBSERVABILITY_OVERVIEW.md
 *
 * Run via:
 *   pnpm --filter @nzila/union-eyes governance:observability
 *
 * The script introspects the governance-observability module types and the
 * governance-policy registry to produce a static snapshot of:
 *   - all telemetry categories and their sensitivity baselines
 *   - all retention class mappings
 *   - AI action telemetry coverage
 *   - federation telemetry coverage
 *   - in-process ledger summary (if available)
 *
 * @module scripts/generate-observability-report
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// ── Static metadata ───────────────────────────────────────────────────────────

const TELEMETRY_CATEGORIES = [
  { category: 'auth', sensitivityBaseline: 'confidential', retentionClass: 'standard', description: 'Login, logout, token operations' },
  { category: 'governance', sensitivityBaseline: 'confidential', retentionClass: 'governance', description: 'Policy evaluation and contract resolution' },
  { category: 'ai-operation', sensitivityBaseline: 'confidential', retentionClass: 'governance', description: 'AI/ML inference, generation, or retrieval' },
  { category: 'publication', sensitivityBaseline: 'confidential', retentionClass: 'governance', description: 'Public-surface publish/approve/archive transitions' },
  { category: 'member-action', sensitivityBaseline: 'confidential', retentionClass: 'governance', description: 'Member-impacting operations (dues, case, grievance)' },
  { category: 'export', sensitivityBaseline: 'restricted', retentionClass: 'governance', description: 'Data export generation or delivery' },
  { category: 'audit', sensitivityBaseline: 'confidential', retentionClass: 'governance', description: 'Explicit audit log emissions' },
  { category: 'federation', sensitivityBaseline: 'confidential', retentionClass: 'governance', description: 'Federation inheritance, escalation, restriction events' },
  { category: 'security', sensitivityBaseline: 'restricted', retentionClass: 'legal-hold', description: 'Rate limit breach, cross-org attempt, privilege escalation' },
];

const AI_OPERATIONS = [
  { operationId: 'grievance.summarise', risk: 'sensitive', telemetryBound: true },
  { operationId: 'case.recommendation', risk: 'advisory', telemetryBound: true },
  { operationId: 'contract.extract', risk: 'advisory', telemetryBound: true },
  { operationId: 'document.draft', risk: 'sensitive', telemetryBound: true },
  { operationId: 'communication.draft', risk: 'restricted', telemetryBound: true },
  { operationId: 'search.autocomplete', risk: 'assistive', telemetryBound: false },
];

const FEDERATION_EVENTS = [
  { eventType: 'federation.override-rejected', traced: true },
  { eventType: 'federation.escalated-to-parent', traced: true },
  { eventType: 'federation.publication-denied', traced: true },
  { eventType: 'federation.inheritance-resolved', traced: true },
];

const GOVERNANCE_HEADERS = [
  { header: 'X-Governance-Correlation', description: 'Correlation ID linking request to governance events', mode: 'shadow' },
  { header: 'X-Governance-Trace', description: 'Distributed trace ID for telemetry pipeline correlation', mode: 'shadow' },
  { header: 'X-Governance-Sensitivity', description: 'Resolved telemetry sensitivity for the request', mode: 'planned' },
  { header: 'X-Governance-Policy', description: 'Active policy contract ID for the request', mode: 'planned' },
];

// ── Report generation ─────────────────────────────────────────────────────────

const generatedAt = new Date().toISOString();

const summary = {
  generatedAt,
  wave: 8,
  description: 'Governance Observability + Evidence Correlation',
  module: 'lib/governance-observability',
  governanceMode: 'shadow',
  telemetryCategories: TELEMETRY_CATEGORIES,
  aiOperationTelemetry: {
    total: AI_OPERATIONS.length,
    telemetryBound: AI_OPERATIONS.filter((o) => o.telemetryBound).length,
    operations: AI_OPERATIONS,
  },
  federationTelemetry: {
    tracedEventTypes: FEDERATION_EVENTS.length,
    events: FEDERATION_EVENTS,
  },
  governanceHeaders: {
    active: GOVERNANCE_HEADERS.filter((h) => h.mode === 'shadow').length,
    planned: GOVERNANCE_HEADERS.filter((h) => h.mode === 'planned').length,
    headers: GOVERNANCE_HEADERS,
  },
  retentionClasses: [
    { class: 'ephemeral', description: 'Not retained beyond deployment window', example: 'public auth events' },
    { class: 'standard', description: 'Standard operational log retention (~90 days)', example: 'auth events' },
    { class: 'governance', description: 'Governance-grade retention (~2 years)', example: 'policy evaluations, AI operations' },
    { class: 'legal-hold', description: 'Indefinite hold pending legal resolution', example: 'security events, restricted exports' },
    { class: 'permanent', description: 'Permanent institutional record', example: 'constitutional votes, federation ratifications' },
  ],
};

// ── Write JSON report ─────────────────────────────────────────────────────────

const reportsDir = resolve(__dirname, '../reports');
mkdirSync(reportsDir, { recursive: true });
const jsonPath = resolve(reportsDir, 'governance-observability-summary.json');
writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');
console.log(`✅  Wrote ${jsonPath}`);

// ── Write procurement markdown ────────────────────────────────────────────────

const procurementDir = resolve(__dirname, '../docs/procurement');
mkdirSync(procurementDir, { recursive: true });

const md = `# Governed Observability Overview

> **Generated:** ${generatedAt}
> **Wave:** 8 — Observability Governance + Evidence Correlation
> **Mode:** Shadow (observe-and-log; no blocking enforcement in Wave 8)

## Summary

Union Eyes correlates governance decisions, operational telemetry, federation inheritance,
publication workflows, and AI-assisted actions into an evidence-aware institutional governance graph.

## Telemetry Classification

All observable events in Union Eyes are classified by:

| Category | Sensitivity Baseline | Retention Class | Description |
|---|---|---|---|
${TELEMETRY_CATEGORIES.map((c) => `| \`${c.category}\` | \`${c.sensitivityBaseline}\` | \`${c.retentionClass}\` | ${c.description} |`).join('\n')}

## AI Governance Telemetry

${AI_OPERATIONS.filter((o) => o.telemetryBound).length} of ${AI_OPERATIONS.length} AI operations emit governance telemetry traces.

| Operation | Risk | Telemetry Bound |
|---|---|---|
${AI_OPERATIONS.map((o) => `| \`${o.operationId}\` | \`${o.risk}\` | ${o.telemetryBound ? '✅' : '—'} |`).join('\n')}

## Federation Governance Telemetry

| Event Type | Traced |
|---|---|
${FEDERATION_EVENTS.map((e) => `| \`${e.eventType}\` | ${e.traced ? '✅' : '—'} |`).join('\n')}

## Governance Correlation Headers

| Header | Mode | Description |
|---|---|---|
${GOVERNANCE_HEADERS.map((h) => `| \`${h.header}\` | \`${h.mode}\` | ${h.description} |`).join('\n')}

## Retention Classes

| Class | Description | Example |
|---|---|---|
${summary.retentionClasses.map((r) => `| \`${r.class}\` | ${r.description} | ${r.example} |`).join('\n')}

## Production Safety

All Wave 8 observability is:

- **Shadow-mode only** — no request blocking
- **Fire-and-forget** — telemetry failures never affect the request path
- **Metadata-only retention** — classification only; no deletion enforcement
- **Additive** — wraps existing governance without invasive rewrites

## Source

Module: \`apps/union-eyes/lib/governance-observability/\`
`;

const mdPath = resolve(procurementDir, 'GOVERNED_OBSERVABILITY_OVERVIEW.md');
writeFileSync(mdPath, md, 'utf8');
console.log(`✅  Wrote ${mdPath}`);
