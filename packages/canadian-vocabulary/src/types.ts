/**
 * Canadian Vocabulary Type Definitions
 *
 * Jurisdiction-scoped types for case types, priorities, statuses,
 * roles, and legal references across all 14 Canadian jurisdictions.
 */

export type CanadianJurisdiction =
  | 'federal'
  | 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU'
  | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

export interface CaseType {
  id: string;
  label: string;
  description: string;
  defaultPriority: 'low' | 'medium' | 'high' | 'critical';
  defaultSeverity: 'minor' | 'moderate' | 'serious' | 'critical';
  legalBasis: string;
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

export interface GrievanceRole {
  id: string;
  label: string;
  description: string;
  canAssign: boolean;
  canEscalate: boolean;
  canSettle: boolean;
}

export interface GrievanceStatus {
  id: string;
  label: string;
  category: 'open' | 'in_progress' | 'resolved' | 'closed';
  allowTransitionsTo: string[];
}

export interface LegalArticles {
  [key: string]: string;
}

export interface LegalReference {
  shortName: string;
  fullName: string;
  keyArticles: LegalArticles;
}

export interface BoardInfo {
  name: string;
  abbreviation: string;
  scope: string;
}

export interface JurisdictionVocabulary {
  jurisdiction: CanadianJurisdiction;
  name: string;
  caseTypes: CaseType[];
  priorities: Priority[];
  severities: Severity[];
  roles: GrievanceRole[];
  statuses: GrievanceStatus[];
  boards: Record<string, BoardInfo>;
  legalReferences: Record<string, LegalReference>;
  version: string;
}

export interface VocabularyValidationError {
  field: string;
  value: unknown;
  message: string;
}
