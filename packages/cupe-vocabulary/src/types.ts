/**
 * Vocabulary Type Definitions
 */

export interface CaseType {
  id: string;
  label: string;
  description: string;
  defaultPriority: 'low' | 'medium' | 'high' | 'critical';
  defaultSeverity: 'minor' | 'moderate' | 'serious' | 'critical';
}

export interface Priority {
  id: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  slaHours: number;
  escalationRequired: boolean;
}

export interface Severity {
  id: 'minor' | 'moderate' | 'serious' | 'critical';
  label: string;
  description: string;
  requiresLegal: boolean;
}

export interface Role {
  id: string;
  label: string;
  description: string;
  canAssign: boolean;
  canEscalate: boolean;
  canSettle: boolean;
}

export interface Status {
  id: string;
  label: string;
  category: 'open' | 'in_progress' | 'resolved' | 'closed';
  allowTransitionsTo: string[];
  allowedRoles: string[];
}

export interface CUPEVocabulary {
  caseTypes: CaseType[];
  priorities: Priority[];
  severities: Severity[];
  roles: Role[];
  statuses: Status[];
  /** When the content below was last revised; stable across calls. */
  lastUpdated: string;
  version: string;
  /** Changes whenever any entry changes, so a client can tell revisions of one version apart. */
  contentDigest: string;
}

export interface VocabularyValidationError {
  field: string;
  value: unknown;
  message: string;
}
