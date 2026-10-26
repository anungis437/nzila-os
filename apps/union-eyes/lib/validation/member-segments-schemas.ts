/**
 * Member Segments Validation Schemas
 * 
 * Phase 1.3: Search & Segmentation
 * 
 * Zod validation schemas for member segments, search filters, and exports.
 * 
 * @module lib/validation/member-segments-schemas
 */

import { z } from "zod";

// =============================================================================
// SEGMENT FILTERS SCHEMA
// =============================================================================

/**
 * Member Segment Filters Schema
 * 
 * Defines all possible filter criteria for member search/segmentation.
 */
export const memberSegmentFiltersSchema = z.object({
  // Text search
  searchQuery: z.string().optional(),
  
  // Member attributes
  status: z.array(z.enum(["active", "inactive", "on-leave", "suspended"])).optional(),
  role: z.array(z.enum(["member", "steward", "officer", "admin"])).optional(),
  membershipType: z.array(z.string()).optional(),
  
  // Organization structure
  employerId: z.array(z.guid()).optional(),
  worksiteId: z.array(z.guid()).optional(),
  bargainingUnitId: z.array(z.guid()).optional(),
  committeeId: z.array(z.guid()).optional(),
  
  // Employment attributes (Phase 1.2 integration)
  employmentStatus: z.array(z.enum(["active", "terminated", "on_leave", "probation"])).optional(),
  jobClassification: z.array(z.string()).optional(),
  checkoffAuthorized: z.boolean().optional(),
  
  // Date ranges (ISO 8601 date strings)
  joinDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  joinDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hireDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hireDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  seniorityDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  seniorityDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  
  // Seniority ranges
  seniorityYearsMin: z.number().min(0).optional(),
  seniorityYearsMax: z.number().min(0).optional(),
  
  // Custom fields (extensible)
  customFields: z.record(z.string(), z.any()).optional(),
}).strict();

export type MemberSegmentFilters = z.infer<typeof memberSegmentFiltersSchema>;

// =============================================================================
// SEGMENT CRUD SCHEMAS
// =============================================================================

/**
 * Create Member Segment Schema
 */
export const createMemberSegmentSchema = z.object({
  organizationId: z.guid("Invalid organization ID"),
  name: z.string().min(1, "Segment name is required").max(200, "Segment name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  filters: memberSegmentFiltersSchema,
  isPublic: z.boolean().default(false),
});

export type CreateMemberSegment = z.infer<typeof createMemberSegmentSchema>;

/**
 * Update Member Segment Schema
 */
export const updateMemberSegmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  filters: memberSegmentFiltersSchema.optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateMemberSegment = z.infer<typeof updateMemberSegmentSchema>;

// =============================================================================
// SEARCH & EXECUTION SCHEMAS
// =============================================================================

/**
 * Execute Search Schema
 * 
 * Used for ad-hoc searches (not saved as segments).
 */
export const executeMemberSearchSchema = z.object({
  organizationId: z.guid("Invalid organization ID"),
  filters: memberSegmentFiltersSchema,
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(1000).default(50),
  }).optional(),
  sortBy: z.enum(["name", "joinDate", "seniority", "relevance"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export type ExecuteMemberSearch = z.infer<typeof executeMemberSearchSchema>;

/**
 * Execute Segment Schema
 * 
 * Run a saved segment by ID.
 */
export const executeSegmentSchema = z.object({
  segmentId: z.guid("Invalid segment ID"),
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(1000).default(50),
  }).optional(),
});

export type ExecuteSegment = z.infer<typeof executeSegmentSchema>;

// =============================================================================
// EXPORT SCHEMAS
// =============================================================================

/**
 * Export Members Schema
 * 
 * Request to export member data with watermarking and audit.
 */
export const exportMembersSchema = z.object({
  organizationId: z.guid("Invalid organization ID"),
  segmentId: z.guid("Invalid segment ID").optional(), // Optional: export from ad-hoc search
  filters: memberSegmentFiltersSchema.optional(), // Required if no segmentId
  
  // Export configuration
  format: z.enum(["csv", "excel", "pdf"]),
  includeFields: z.array(z.string()).min(1, "Must include at least one field"),
  
  // Optional metadata
  purpose: z.string().max(500).optional(),
  
  // Watermarking options
  includeWatermark: z.boolean().default(true),
}).refine(
  (data) => data.segmentId || data.filters,
  {
    message: "Must provide either segmentId or filters",
    path: ["segmentId"],
  }
);

export type ExportMembers = z.infer<typeof exportMembersSchema>;

/**
 * Export Fields Schema
 * 
 * Defines which member fields can be exported.
 */
export const exportableFieldsSchema = z.enum([
  // Basic info
  "id",
  "fullName",
  "firstName",
  "lastName",
  "email",
  "phone",
  "dateOfBirth",
  
  // Membership
  "status",
  "role",
  "membershipType",
  "joinDate",
  "memberNumber",
  
  // Address
  "address",
  "city",
  "province",
  "postalCode",
  "country",
  
  // Employment
  "employerId",
  "employerName",
  "worksiteId",
  "worksiteName",
  "bargainingUnitId",
  "bargainingUnitName",
  "jobTitle",
  "jobClassification",
  "hireDate",
  "terminationDate",
  "employmentStatus",
  
  // Seniority
  "seniorityDate",
  "seniorityYears",
  
  // Dues
  "checkoffAuthorized",
  "lastDuesPayment",
  "duesAmount",
  
  // Contact preferences
  "preferredLanguage",
  "emailOptIn",
  "smsOptIn",
  
  // Timestamps
  "createdAt",
  "updatedAt",
]);

export type ExportableField = z.infer<typeof exportableFieldsSchema>;

// =============================================================================
// PAGINATION & SORTING
// =============================================================================

/**
 * Pagination Schema
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(1000).default(50),
});

export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Sort Schema
 */
export const sortSchema = z.object({
  sortBy: z.enum(["name", "joinDate", "seniority", "relevance"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export type Sort = z.infer<typeof sortSchema>;
