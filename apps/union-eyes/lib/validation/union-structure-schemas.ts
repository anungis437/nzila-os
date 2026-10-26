// =====================================================================================
// UNION STRUCTURE - Zod Validation Schemas
// =====================================================================================
// Version: 1.0
// Created: February 13, 2026
// Purpose: Input validation for union structure orgs (employers, worksites, units, etc.)
// Roadmap: UnionWare Phase 1.1 - Core AMS Parity
// =====================================================================================

import { z } from 'zod';
import { partialWithoutDefaults } from './partial-without-defaults';

// =====================================================
// Common Validators
// =====================================================

const addressSchema = z.object({
  street: z.string().optional(),
  unit: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional().default('Canada'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const phoneSchema = z
  .string()
  .regex(/^[\d\s\-\+\(\)\.ext]+$/, 'Invalid phone number format')
  .optional();

const emailSchema = z.string().email().optional();

const uuidSchema = z.guid();

// =====================================================
// Employer Schemas
// =====================================================

export const createEmployerSchema = z.object({
  organizationId: uuidSchema,
  name: z.string().min(1, 'Name is required').max(255),
  legalName: z.string().max(255).optional(),
  dbaName: z.string().max(255).optional(),
  employerType: z.enum([
    'private',
    'public',
    'non_profit',
    'crown_corporation',
    'municipal',
    'provincial',
    'federal',
    'educational',
    'healthcare',
  ]),
  status: z
    .enum(['active', 'inactive', 'contract_expired', 'in_bargaining', 'dispute', 'archived'])
    .default('active'),

  // Identification
  businessNumber: z.string().max(50).optional(),
  federalCorporationNumber: z.string().max(50).optional(),
  provincialCorporationNumber: z.string().max(50).optional(),
  industryCode: z.string().max(20).optional(),

  // Contact
  email: emailSchema,
  phone: phoneSchema,
  website: z.string().url().max(500).optional().or(z.literal('')),
  mainAddress: addressSchema.optional(),

  // Operational
  totalEmployees: z.number().int().min(0).optional(),
  unionizedEmployees: z.number().int().min(0).optional(),
  establishedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // Contacts
  primaryContactName: z.string().max(255).optional(),
  primaryContactTitle: z.string().max(255).optional(),
  primaryContactEmail: emailSchema,
  primaryContactPhone: phoneSchema,

  labourRelationsContactName: z.string().max(255).optional(),
  labourRelationsContactEmail: emailSchema,
  labourRelationsContactPhone: phoneSchema,

  // Relationships
  parentCompanyId: uuidSchema.optional(),

  // Additional
  notes: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

export const updateEmployerSchema = partialWithoutDefaults(createEmployerSchema)
  .omit({ organizationId: true });

export const employerQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
  status: z
    .enum(['active', 'inactive', 'contract_expired', 'in_bargaining', 'dispute', 'archived'])
    .optional(),
  employerType: z
    .enum([
      'private',
      'public',
      'non_profit',
      'crown_corporation',
      'municipal',
      'provincial',
      'federal',
      'educational',
      'healthcare',
    ])
    .optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// =====================================================
// Worksite Schemas
// =====================================================

export const createWorksiteSchema = z.object({
  organizationId: uuidSchema,
  employerId: uuidSchema,
  name: z.string().min(1, 'Name is required').max(255),
  code: z.string().max(50).optional(),
  status: z
    .enum(['active', 'temporarily_closed', 'permanently_closed', 'seasonal', 'archived'])
    .default('active'),

  // Location
  address: addressSchema.optional(),

  // Operational
  employeeCount: z.number().int().min(0).optional(),
  shiftCount: z.number().int().min(0).optional(),
  operatesWeekends: z.boolean().default(false),
  operates24Hours: z.boolean().default(false),

  // Site Manager
  siteManagerName: z.string().max(255).optional(),
  siteManagerEmail: emailSchema,
  siteManagerPhone: phoneSchema,

  // Additional
  description: z.string().optional(),
  notes: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

export const updateWorksiteSchema = partialWithoutDefaults(createWorksiteSchema)
  .omit({ organizationId: true, employerId: true });

export const worksiteQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
  employerId: uuidSchema.optional(),
  status: z
    .enum(['active', 'temporarily_closed', 'permanently_closed', 'seasonal', 'archived'])
    .optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// =====================================================
// Bargaining Unit Schemas
// =====================================================

export const classificationSchema = z.object({
  title: z.string().min(1),
  count: z.number().int().min(0).optional(),
  payGrade: z.string().optional(),
});

export const createBargainingUnitSchema = z.object({
  organizationId: uuidSchema,
  employerId: uuidSchema,
  worksiteId: uuidSchema.optional(),

  // Basic info
  name: z.string().min(1, 'Name is required').max(255),
  unitNumber: z.string().max(50).optional(),
  unitType: z.enum(['full_time', 'part_time', 'casual', 'mixed', 'craft', 'industrial', 'professional']),
  status: z
    .enum(['active', 'under_certification', 'decertified', 'merged', 'inactive', 'archived'])
    .default('active'),

  // Certification
  certificationNumber: z.string().max(100).optional(),
  certificationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  certificationBody: z.string().max(100).optional(),
  certificationExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // Bargaining
  currentCollectiveAgreementId: uuidSchema.optional(),
  contractExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nextBargainingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // Composition
  memberCount: z.number().int().min(0).default(0),
  classifications: z.array(classificationSchema).optional(),

  // Representation
  chiefStewardId: z.string().optional(),
  bargainingChairId: z.string().optional(),

  // Additional
  description: z.string().optional(),
  notes: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

export const updateBargainingUnitSchema = partialWithoutDefaults(createBargainingUnitSchema)
  .omit({ organizationId: true, employerId: true });

export const bargainingUnitQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
  employerId: uuidSchema.optional(),
  worksiteId: uuidSchema.optional(),
  status: z
    .enum(['active', 'under_certification', 'decertified', 'merged', 'inactive', 'archived'])
    .optional(),
  contractExpiring: z.boolean().optional(), // Filter units with expiring contracts
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// =====================================================
// Committee Schemas
// =====================================================

export const createCommitteeSchema = z.object({
  organizationId: uuidSchema,
  name: z.string().min(1, 'Name is required').max(255),
  committeeType: z.enum([
    'bargaining',
    'grievance',
    'health_safety',
    'political_action',
    'equity',
    'education',
    'organizing',
    'steward',
    'executive',
    'finance',
    'communications',
    'social',
    'pension_benefits',
    'other',
  ]),
  status: z.string().default('active'),

  // Scope
  unitId: uuidSchema.optional(),
  worksiteId: uuidSchema.optional(),
  isOrganizationWide: z.boolean().default(false),

  // Details
  mandate: z.string().optional(),
  meetingFrequency: z.string().max(100).optional(),
  meetingDay: z.string().max(50).optional(),
  meetingTime: z.string().max(50).optional(),
  meetingLocation: z.string().optional(),

  // Composition
  maxMembers: z.number().int().min(1).optional(),
  currentMemberCount: z.number().int().min(0).default(0),
  requiresAppointment: z.boolean().default(false),
  requiresElection: z.boolean().default(false),
  termLength: z.number().int().min(1).optional(), // months

  // Leadership
  chairId: z.string().optional(),
  secretaryId: z.string().optional(),
  contactEmail: emailSchema,

  // Additional
  description: z.string().optional(),
  notes: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

export const updateCommitteeSchema = partialWithoutDefaults(createCommitteeSchema).omit({ organizationId: true });

export const committeeQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
  committeeType: z
    .enum([
      'bargaining',
      'grievance',
      'health_safety',
      'political_action',
      'equity',
      'education',
      'organizing',
      'steward',
      'executive',
      'finance',
      'communications',
      'social',
      'pension_benefits',
      'other',
    ])
    .optional(),
  unitId: uuidSchema.optional(),
  worksiteId: uuidSchema.optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// =====================================================
// Committee Membership Schemas
// =====================================================

export const createCommitteeMembershipSchema = z.object({
  committeeId: uuidSchema,
  memberId: z.string().min(1),
  role: z
    .enum(['chair', 'vice_chair', 'secretary', 'treasurer', 'member', 'alternate', 'advisor', 'ex_officio'])
    .default('member'),
  status: z.string().default('active'),

  // Tenure
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  termNumber: z.number().int().min(1).default(1),

  // Appointment/Election
  appointmentMethod: z.enum(['elected', 'appointed', 'ex_officio']).optional(),
  appointedBy: z.string().optional(),
  electionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  votesReceived: z.number().int().min(0).optional(),

  // Attendance
  meetingsAttended: z.number().int().min(0).default(0),
  meetingsTotal: z.number().int().min(0).default(0),

  notes: z.string().optional(),
});

export const updateCommitteeMembershipSchema = partialWithoutDefaults(createCommitteeMembershipSchema)
  .omit({ committeeId: true, memberId: true });

export const committeeMembershipQuerySchema = z.object({
  committeeId: uuidSchema.optional(),
  memberId: z.string().optional(),
  role: z
    .enum(['chair', 'vice_chair', 'secretary', 'treasurer', 'member', 'alternate', 'advisor', 'ex_officio'])
    .optional(),
  status: z.string().optional(),
  active: z.boolean().optional(), // Filter by active memberships (endDate is null)
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// =====================================================
// Steward Assignment Schemas
// =====================================================

export const createStewardAssignmentSchema = z.object({
  organizationId: uuidSchema,
  stewardId: z.string().min(1),
  stewardType: z.enum(['chief_steward', 'steward', 'alternate_steward', 'health_safety_rep']),
  status: z.string().default('active'),

  // Coverage
  unitId: uuidSchema.optional(),
  worksiteId: uuidSchema.optional(),
  department: z.string().max(255).optional(),
  shift: z.string().max(100).optional(),
  floor: z.string().max(100).optional(),
  area: z.string().max(255).optional(),

  // Tenure
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isInterim: z.boolean().default(false),

  // Appointment
  appointedBy: z.string().optional(),
  electedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  certificationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // Responsibilities
  responsibilityAreas: z.array(z.string()).optional(),
  membersCovered: z.number().int().min(0).optional(),

  // Training
  trainingCompleted: z.boolean().default(false),
  trainingCompletionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  certificationExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // Contact
  workPhone: phoneSchema,
  personalPhone: phoneSchema,
  preferredContactMethod: z.string().max(50).optional(),
  availabilityNotes: z.string().optional(),

  notes: z.string().optional(),
});

export const updateStewardAssignmentSchema = partialWithoutDefaults(createStewardAssignmentSchema)
  .omit({ organizationId: true, stewardId: true });

export const stewardAssignmentQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
  stewardId: z.string().optional(),
  stewardType: z.enum(['chief_steward', 'steward', 'alternate_steward', 'health_safety_rep']).optional(),
  unitId: uuidSchema.optional(),
  worksiteId: uuidSchema.optional(),
  status: z.string().optional(),
  active: z.boolean().optional(), // Filter by active assignments
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// =====================================================
// Role Tenure History Schemas
// =====================================================

export const createRoleTenureHistorySchema = z.object({
  organizationId: uuidSchema,
  memberId: z.string().min(1),
  roleType: z.string().min(1).max(100),
  roleTitle: z.string().min(1).max(255),
  roleLevel: z.string().max(50).optional(),

  // Related entity
  relatedEntityType: z.enum(['committee', 'unit', 'organization']).optional(),
  relatedEntityId: uuidSchema.optional(),

  // Tenure
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isCurrentRole: z.boolean().default(true),

  // Appointment/Election
  appointmentMethod: z.enum(['elected', 'appointed', 'acclaimed']).optional(),
  electionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  votesReceived: z.number().int().min(0).optional(),
  voteTotal: z.number().int().min(0).optional(),
  termLength: z.number().int().min(1).optional(), // months
  termNumber: z.number().int().min(1).default(1),

  // End of role
  endReason: z
    .enum(['term_expired', 'resigned', 'removed', 'transferred', 'retired', 'other'])
    .optional(),
  endedBy: z.string().optional(),

  // Performance
  notes: z.string().optional(),
  achievements: z.array(z.string()).optional(),
});

export const updateRoleTenureHistorySchema = partialWithoutDefaults(createRoleTenureHistorySchema)
  .omit({ organizationId: true, memberId: true });

export const roleTenureHistoryQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
  memberId: z.string().optional(),
  roleType: z.string().optional(),
  relatedEntityType: z.enum(['committee', 'unit', 'organization']).optional(),
  relatedEntityId: uuidSchema.optional(),
  isCurrentRole: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// =====================================================
// Bulk Operations (for import/export)
// =====================================================

export const bulkCreateEmployersSchema = z.object({
  employers: z.array(createEmployerSchema).min(1).max(100),
  validateOnly: z.boolean().default(false),
});

export const bulkCreateWorksitesSchema = z.object({
  worksites: z.array(createWorksiteSchema).min(1).max(100),
  validateOnly: z.boolean().default(false),
});

export const bulkCreateBargainingUnitsSchema = z.object({
  units: z.array(createBargainingUnitSchema).min(1).max(100),
  validateOnly: z.boolean().default(false),
});

// =====================================================
// Type Exports (for TypeScript inference)
// =====================================================

export type CreateEmployerInput = z.infer<typeof createEmployerSchema>;
export type UpdateEmployerInput = z.infer<typeof updateEmployerSchema>;
export type EmployerQuery = z.infer<typeof employerQuerySchema>;

export type CreateWorksiteInput = z.infer<typeof createWorksiteSchema>;
export type UpdateWorksiteInput = z.infer<typeof updateWorksiteSchema>;
export type WorksiteQuery = z.infer<typeof worksiteQuerySchema>;

export type CreateBargainingUnitInput = z.infer<typeof createBargainingUnitSchema>;
export type UpdateBargainingUnitInput = z.infer<typeof updateBargainingUnitSchema>;
export type BargainingUnitQuery = z.infer<typeof bargainingUnitQuerySchema>;

export type CreateCommitteeInput = z.infer<typeof createCommitteeSchema>;
export type UpdateCommitteeInput = z.infer<typeof updateCommitteeSchema>;
export type CommitteeQuery = z.infer<typeof committeeQuerySchema>;

export type CreateCommitteeMembershipInput = z.infer<typeof createCommitteeMembershipSchema>;
export type UpdateCommitteeMembershipInput = z.infer<typeof updateCommitteeMembershipSchema>;
export type CommitteeMembershipQuery = z.infer<typeof committeeMembershipQuerySchema>;

export type CreateStewardAssignmentInput = z.infer<typeof createStewardAssignmentSchema>;
export type UpdateStewardAssignmentInput = z.infer<typeof updateStewardAssignmentSchema>;
export type StewardAssignmentQuery = z.infer<typeof stewardAssignmentQuerySchema>;

export type CreateRoleTenureHistoryInput = z.infer<typeof createRoleTenureHistorySchema>;
export type UpdateRoleTenureHistoryInput = z.infer<typeof updateRoleTenureHistorySchema>;
export type RoleTenureHistoryQuery = z.infer<typeof roleTenureHistoryQuerySchema>;
