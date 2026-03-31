/**
 * Quebec Vocabulary Type Definitions
 * 
 * Bilingual (FR/EN) types for Quebec labour relations.
 * Extends the base vocabulary interface with French labels and Quebec-specific legal references.
 */

export interface QCCaseType {
  id: string;
  label: string;        // French (primary)
  labelEn: string;      // English
  description: string;  // French
  descriptionEn: string;
  defaultPriority: 'low' | 'medium' | 'high' | 'critical';
  defaultSeverity: 'minor' | 'moderate' | 'serious' | 'critical';
  legalBasis: string;
}

export interface QCPriority {
  id: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  labelEn: string;
  slaHours: number;
  escalationRequired: boolean;
}

export interface QCSeverity {
  id: 'minor' | 'moderate' | 'serious' | 'critical';
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  requiresLegal: boolean;
}

export interface QCRole {
  id: string;
  label: string;
  labelEn: string;
  description: string;
  canAssign: boolean;
  canEscalate: boolean;
  canSettle: boolean;
}

export interface QCStatus {
  id: string;
  label: string;
  labelEn: string;
  category: 'open' | 'in_progress' | 'resolved' | 'closed';
  allowTransitionsTo: string[];
  allowedRoles: string[];
}

export interface TATDivision {
  id: string;
  name: string;
  nameEn: string;
  jurisdiction: string[];
}

export interface CNESSTMandate {
  id: string;
  name: string;
  nameEn: string;
  scope: string;
}

export interface TribunalInfo {
  name: string;
  nameEn: string;
  abbreviation: string;
  divisions?: TATDivision[];
  mandates?: CNESSTMandate[];
}

export interface LegalArticles {
  [key: string]: string;
}

export interface LegalReference {
  shortName: string;
  fullName: string;
  fullNameEn: string;
  keyArticles: LegalArticles;
}

export interface QuebecVocabulary {
  caseTypes: QCCaseType[];
  priorities: QCPriority[];
  severities: QCSeverity[];
  roles: QCRole[];
  statuses: QCStatus[];
  tribunals: Record<string, TribunalInfo>;
  legalReferences: Record<string, LegalReference>;
  lastUpdated: string;
  version: string;
  locale: string;
  jurisdiction: string;
}

export interface VocabularyValidationError {
  field: string;
  value: unknown;
  message: string;
}
