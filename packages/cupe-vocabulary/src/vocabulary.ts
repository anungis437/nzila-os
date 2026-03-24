/**
 * CUPE Vocabulary Loader and Manager
 * 
 * v0.1: Hardcoded CUPE defaults loaded at startup.
 * v0.2+: Support for JSON configuration files and per-org overrides.
 */

import { CUPEVocabulary, CaseType, Priority, Severity, Role, Status } from './types';

const CUPE_CASE_TYPES: CaseType[] = [
  { id: 'discipline', label: 'Discipline', description: 'Disciplinary action by employer', defaultPriority: 'high', defaultSeverity: 'serious' },
  { id: 'harassment', label: 'Harassment', description: 'Workplace harassment or bullying', defaultPriority: 'high', defaultSeverity: 'serious' },
  { id: 'discrimination', label: 'Discrimination', description: 'Discrimination based on protected characteristics', defaultPriority: 'critical', defaultSeverity: 'critical' },
  { id: 'wage_dispute', label: 'Wage Dispute', description: 'Pay, overtime, or benefits dispute', defaultPriority: 'medium', defaultSeverity: 'serious' },
  { id: 'benefits_denial', label: 'Benefits Denial', description: 'Denial of earned benefits or entitlements', defaultPriority: 'medium', defaultSeverity: 'serious' },
  { id: 'recall_rehire', label: 'Recall/Rehire', description: 'Issues with recall or rehiring process', defaultPriority: 'medium', defaultSeverity: 'moderate' },
  { id: 'safety', label: 'Health & Safety', description: 'Workplace safety or health concerns', defaultPriority: 'critical', defaultSeverity: 'critical' },
  { id: 'contracting', label: 'Contracting Out', description: 'Improper contracting out of union work', defaultPriority: 'high', defaultSeverity: 'serious' },
  { id: 'dues', label: 'Dues/Deduction Issue', description: 'Issue with union dues or deductions', defaultPriority: 'low', defaultSeverity: 'minor' },
  { id: 'other', label: 'Other', description: 'Grievance not covered by above categories', defaultPriority: 'medium', defaultSeverity: 'moderate' },
];

const CUPE_PRIORITIES: Priority[] = [
  { id: 'low', label: 'Low', slaHours: 168, escalationRequired: false }, // 1 week
  { id: 'medium', label: 'Medium', slaHours: 72, escalationRequired: false }, // 3 days
  { id: 'high', label: 'High', slaHours: 48, escalationRequired: true }, // 2 days
  { id: 'critical', label: 'Critical', slaHours: 24, escalationRequired: true }, // 1 day (safety, discrimination)
];

const CUPE_SEVERITIES: Severity[] = [
  { id: 'minor', label: 'Minor', description: 'Minor issue, low impact', requiresLegal: false },
  { id: 'moderate', label: 'Moderate', description: 'Moderate issue, affects individual', requiresLegal: false },
  { id: 'serious', label: 'Serious', description: 'Serious issue, affects multiple members or has legal implications', requiresLegal: true },
  { id: 'critical', label: 'Critical', description: 'Critical issue, safety threat, discrimination, or systemic violation', requiresLegal: true },
];

const CUPE_ROLES: Role[] = [
  { id: 'member', label: 'Member', description: 'Union member', canAssign: false, canEscalate: false, canSettle: false },
  { id: 'steward', label: 'Steward', description: 'Workplace steward (LRO)', canAssign: true, canEscalate: true, canSettle: false },
  { id: 'chief_steward', label: 'Chief Steward', description: 'Chief steward or lead representative', canAssign: true, canEscalate: true, canSettle: true },
  { id: 'business_agent', label: 'Business Agent', description: 'National union representative', canAssign: true, canEscalate: true, canSettle: true },
  { id: 'officer', label: 'Officer', description: 'Local union officer', canAssign: true, canEscalate: true, canSettle: true },
  { id: 'admin', label: 'Administrator', description: 'System administrator', canAssign: true, canEscalate: true, canSettle: true },
];

const CUPE_STATUSES: Status[] = [
  { id: 'draft', label: 'Draft', category: 'open', allowTransitionsTo: ['filed'], allowedRoles: ['member', 'steward'] },
  { id: 'filed', label: 'Filed', category: 'open', allowTransitionsTo: ['acknowledged'], allowedRoles: ['steward', 'chief_steward', 'admin'] },
  { id: 'acknowledged', label: 'Acknowledged', category: 'in_progress', allowTransitionsTo: ['investigating', 'escalated'], allowedRoles: ['steward', 'chief_steward', 'admin'] },
  { id: 'investigating', label: 'Under Investigation', category: 'in_progress', allowTransitionsTo: ['response_due', 'escalated', 'settled'], allowedRoles: ['steward', 'chief_steward', 'business_agent', 'admin'] },
  { id: 'response_due', label: 'Awaiting Response', category: 'in_progress', allowTransitionsTo: ['escalated', 'settled', 'denied'], allowedRoles: ['steward', 'chief_steward', 'business_agent', 'admin'] },
  { id: 'escalated', label: 'Escalated', category: 'in_progress', allowTransitionsTo: ['mediation', 'denied', 'settled'], allowedRoles: ['chief_steward', 'business_agent', 'officer', 'admin'] },
  { id: 'mediation', label: 'In Mediation', category: 'in_progress', allowTransitionsTo: ['arbitration', 'settled', 'denied'], allowedRoles: ['business_agent', 'officer', 'admin'] },
  { id: 'arbitration', label: 'In Arbitration', category: 'in_progress', allowTransitionsTo: ['settled', 'denied'], allowedRoles: ['business_agent', 'officer', 'admin'] },
  { id: 'settled', label: 'Settled', category: 'resolved', allowTransitionsTo: ['closed'], allowedRoles: ['steward', 'chief_steward', 'business_agent', 'officer', 'admin'] },
  { id: 'denied', label: 'Denied', category: 'resolved', allowTransitionsTo: ['closed', 'escalated'], allowedRoles: ['steward', 'chief_steward', 'business_agent', 'officer', 'admin'] },
  { id: 'withdrawn', label: 'Withdrawn', category: 'closed', allowTransitionsTo: [], allowedRoles: ['member', 'steward', 'chief_steward', 'admin'] },
  { id: 'closed', label: 'Closed', category: 'closed', allowTransitionsTo: [], allowedRoles: ['steward', 'chief_steward', 'business_agent', 'officer', 'admin'] },
];

/**
 * Get the complete CUPE vocabulary.
 * 
 * v0.1: Returns hardcoded defaults.
 * Future: Will support loading from JSON config files and per-org overrides.
 */
export function getCUPEVocabulary(): CUPEVocabulary {
  return {
    caseTypes: CUPE_CASE_TYPES,
    priorities: CUPE_PRIORITIES,
    severities: CUPE_SEVERITIES,
    roles: CUPE_ROLES,
    statuses: CUPE_STATUSES,
    lastUpdated: new Date().toISOString(),
    version: '0.1.0',
  };
}

/**
 * Get a specific case type by ID.
 */
export function getCaseTypeById(caseTypeId: string): CaseType | undefined {
  return CUPE_CASE_TYPES.find((ct) => ct.id === caseTypeId);
}

/**
 * Get a specific priority by ID.
 */
export function getPriorityById(priorityId: string): Priority | undefined {
  return CUPE_PRIORITIES.find((p) => p.id === priorityId);
}

/**
 * Get a specific status by ID.
 */
export function getStatusById(statusId: string): Status | undefined {
  return CUPE_STATUSES.find((s) => s.id === statusId);
}

/**
 * Get all valid case type IDs.
 */
export function getAllCaseTypeIds(): string[] {
  return CUPE_CASE_TYPES.map((ct) => ct.id);
}

/**
 * Get all valid priority IDs.
 */
export function getAllPriorityIds(): string[] {
  return CUPE_PRIORITIES.map((p) => p.id);
}

/**
 * Get all valid status IDs.
 */
export function getAllStatusIds(): string[] {
  return CUPE_STATUSES.map((s) => s.id);
}

/**
 * Get all status IDs in a specific category (open, in_progress, resolved, closed).
 */
export function getStatusesByCategory(category: 'open' | 'in_progress' | 'resolved' | 'closed'): Status[] {
  return CUPE_STATUSES.filter((s) => s.category === category);
}
