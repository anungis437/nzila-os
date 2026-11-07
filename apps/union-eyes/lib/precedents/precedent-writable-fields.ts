/**
 * The body fields a content manager may write on a shared arbitration decision (DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT). The counters, the
 * embedding, the import provenance and the supplying organization are server-owned. Publication (isPublic, accessRestrictions) stays
 * writable because the routes' writeRole is the platform editorial role, which is the authority that publishes shared reference data.
 */
export const PRECEDENT_WRITABLE_FIELDS: readonly string[] = [
  'caseNumber', 'caseTitle', 'tribunal', 'decisionType', 'decisionDate', 'filingDate', 'hearingDate',
  'arbitrator', 'panelMembers', 'grievor', 'union', 'employer', 'outcome', 'remedy',
  'keyFindings', 'issueTypes', 'precedentValue', 'legalCitations', 'relatedDecisions', 'cbaReferences',
  'fullText', 'summary', 'headnote', 'precedentSummary', 'reasoning', 'keyFacts',
  'sector', 'jurisdiction', 'language', 'isPublic', 'accessRestrictions',
];
