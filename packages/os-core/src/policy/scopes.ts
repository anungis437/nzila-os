/**
 * @nzila/os-core — RBAC Scopes
 *
 * Fine-grained permission scopes within a role.
 * Scopes are checked AFTER role checks for resource-specific access.
 */

// ── Resource scopes ───────────────────────────────────────────────────────

export const Scope = {
  // Governance
  GOVERNANCE_READ: 'governance:read',
  GOVERNANCE_WRITE: 'governance:write',
  GOVERNANCE_EXECUTE: 'governance:execute',
  GOVERNANCE_ADMIN: 'governance:admin',

  // Finance
  FINANCE_READ: 'finance:read',
  FINANCE_WRITE: 'finance:write',
  FINANCE_CLOSE: 'finance:close',
  FINANCE_ADMIN: 'finance:admin',

  // Evidence
  EVIDENCE_READ: 'evidence:read',
  EVIDENCE_WRITE: 'evidence:write',
  EVIDENCE_ADMIN: 'evidence:admin',

  // ML
  ML_SCORES_READ: 'ml:scores:read',
  ML_MODELS_READ: 'ml:models:read',
  ML_MODELS_WRITE: 'ml:models:write',
  ML_MODELS_ACTIVATE: 'ml:models:activate',

  // AI
  AI_GENERATE: 'ai:generate',
  AI_ADMIN: 'ai:admin',

  // Partners
  PARTNER_READ: 'partner:read',
  PARTNER_WRITE: 'partner:write',
  PARTNER_ADMIN: 'partner:admin',
  PARTNER_ENTITY_READ: 'partner:entity:read',

  // Admin
  ADMIN_RETENTION: 'admin:retention',
  ADMIN_CHANGE_CONTROL: 'admin:change_control',
  ADMIN_USER_MANAGEMENT: 'admin:user_management',
  ADMIN_SYSTEM: 'admin:system',

  // Webhooks
  WEBHOOK_READ: 'webhook:read',
  WEBHOOK_REPLAY: 'webhook:replay',
} as const

export type Scope = (typeof Scope)[keyof typeof Scope]

import type { NzilaRole } from './roles'
import { ConsoleRole, PartnerRole, UERole, SystemRole } from './roles'

/** Default scopes granted to each role. */
export const ROLE_DEFAULT_SCOPES: Record<NzilaRole, Scope[]> = {
  [ConsoleRole.SUPER_ADMIN]: Object.values(Scope),
  [ConsoleRole.ADMIN]: [
    Scope.GOVERNANCE_READ, Scope.GOVERNANCE_WRITE, Scope.GOVERNANCE_EXECUTE,
    Scope.FINANCE_READ, Scope.EVIDENCE_READ, Scope.EVIDENCE_WRITE,
    Scope.ML_SCORES_READ, Scope.ML_MODELS_READ, Scope.ML_MODELS_WRITE,
    Scope.AI_GENERATE, Scope.PARTNER_READ, Scope.WEBHOOK_READ, Scope.WEBHOOK_REPLAY,
    Scope.ADMIN_CHANGE_CONTROL,
  ],
  [ConsoleRole.FINANCE_ADMIN]: [
    Scope.FINANCE_READ, Scope.FINANCE_WRITE, Scope.FINANCE_CLOSE,
    Scope.EVIDENCE_READ, Scope.EVIDENCE_WRITE, Scope.GOVERNANCE_READ,
  ],
  [ConsoleRole.FINANCE_VIEWER]: [Scope.FINANCE_READ, Scope.EVIDENCE_READ, Scope.GOVERNANCE_READ],
  [ConsoleRole.ML_ENGINEER]: [
    Scope.ML_SCORES_READ, Scope.ML_MODELS_READ, Scope.ML_MODELS_WRITE,
    Scope.ML_MODELS_ACTIVATE, Scope.EVIDENCE_READ,
  ],
  [ConsoleRole.COMPLIANCE_OFFICER]: [
    Scope.EVIDENCE_READ, Scope.EVIDENCE_ADMIN, Scope.GOVERNANCE_READ,
    Scope.FINANCE_READ, Scope.ADMIN_RETENTION,
  ],
  [ConsoleRole.DEVELOPER]: [
    Scope.GOVERNANCE_READ, Scope.FINANCE_READ, Scope.EVIDENCE_READ,
    Scope.ML_SCORES_READ, Scope.AI_GENERATE,
  ],
  [ConsoleRole.VIEWER]: [Scope.GOVERNANCE_READ, Scope.FINANCE_READ, Scope.EVIDENCE_READ],
  [PartnerRole.CHANNEL_ADMIN]: [
    Scope.PARTNER_READ, Scope.PARTNER_WRITE, Scope.PARTNER_ENTITY_READ,
    Scope.ML_SCORES_READ,
  ],
  [PartnerRole.CHANNEL_SALES]: [Scope.PARTNER_READ, Scope.PARTNER_ENTITY_READ],
  [PartnerRole.CHANNEL_EXECUTIVE]: [Scope.PARTNER_READ, Scope.PARTNER_ENTITY_READ],
  [PartnerRole.ISV_ADMIN]: [
    Scope.PARTNER_READ, Scope.PARTNER_WRITE, Scope.PARTNER_ENTITY_READ,
  ],
  [PartnerRole.ISV_TECHNICAL]: [Scope.PARTNER_READ, Scope.PARTNER_ENTITY_READ],
  [PartnerRole.ENTERPRISE_ADMIN]: [
    Scope.PARTNER_READ, Scope.PARTNER_WRITE, Scope.PARTNER_ENTITY_READ,
  ],
  [PartnerRole.ENTERPRISE_USER]: [Scope.PARTNER_READ, Scope.PARTNER_ENTITY_READ],
  [UERole.SUPERVISOR]: [
    Scope.GOVERNANCE_READ, Scope.GOVERNANCE_WRITE, Scope.ML_SCORES_READ,
  ],
  [UERole.CASE_MANAGER]: [Scope.GOVERNANCE_READ, Scope.GOVERNANCE_WRITE, Scope.ML_SCORES_READ],
  [UERole.ANALYST]: [Scope.GOVERNANCE_READ, Scope.ML_SCORES_READ],
  [UERole.VIEWER]: [Scope.GOVERNANCE_READ],
  [SystemRole.WEBHOOK_PROCESSOR]: [Scope.WEBHOOK_READ, Scope.GOVERNANCE_WRITE],
  [SystemRole.CRON_JOB]: [Scope.EVIDENCE_WRITE, Scope.ML_SCORES_READ],
  [SystemRole.MIGRATION]: [Scope.ADMIN_SYSTEM],
}
