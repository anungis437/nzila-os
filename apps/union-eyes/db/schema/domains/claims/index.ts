/**
 * Claims Domain
 * 
 * Claims, grievances, and legal deadline schemas.
 * 
 * This domain consolidates:
 * - claims-schema.ts
 * - grievance-schema.ts
 * - deadlines-schema.ts
 * - grievance-workflow-schema.ts (727 lines)
 * 
 * Priority: 2
 * 
 * Duplicates to resolve:
 * - grievanceDeadlines (2 locations)
 * - GrievanceType type (2 locations)
 */

// Export all claims-related schemas from consolidated domain location
export * from './claims';
export * from './grievances';
export * from './deadlines';
export * from './workflows';
export * from './grievance-lifecycle';
export * from './satisfaction';

// Explicit re-exports to resolve ambiguities
// grievanceDeadlines and GrievanceDeadline exist in both grievances.ts and workflows.ts
// Use the main definitions from grievances.ts
export { grievanceDeadlines, type GrievanceDeadline } from './grievances';

// grievanceDocuments and GrievanceDocument exist in both workflows.ts and grievance-lifecycle.ts
// Use the full definitions from workflows.ts (has organizationId, documentName, versioning, OCR etc.)
export { grievanceDocuments, type GrievanceDocument } from './workflows';
