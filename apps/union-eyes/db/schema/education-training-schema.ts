import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  _pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "../schema-organizations";

// Training Courses Table
export const trainingCourses = pgTable("training_courses", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  organizationId: uuid("organization_id").notNull(),
  courseCode: varchar("course_code", { length: 50 }).notNull(),
  courseName: varchar("course_name", { length: 300 }).notNull(),
  courseDescription: text("course_description"),
  courseCategory: varchar("course_category", { length: 50 }).notNull(),
  deliveryMethod: varchar("delivery_method", { length: 50 }).notNull(),
  courseDifficulty: varchar("course_difficulty", { length: 20 }).default('all_levels'),
  durationHours: numeric("duration_hours", { precision: 5, scale: 2 }),
  durationDays: integer("duration_days"),
  hasPrerequisites: boolean("has_prerequisites").default(false),
  prerequisiteCourses: jsonb("prerequisite_courses"),
  prerequisiteCertifications: jsonb("prerequisite_certifications"),
  learningObjectives: text("learning_objectives"),
  courseOutline: jsonb("course_outline"),
  courseMaterialsUrl: text("course_materials_url"),
  presentationSlidesUrl: text("presentation_slides_url"),
  workbookUrl: text("workbook_url"),
  additionalResources: jsonb("additional_resources"),
  primaryInstructorName: varchar("primary_instructor_name", { length: 200 }),
  instructorIds: jsonb("instructor_ids"),
  minEnrollment: integer("min_enrollment").default(5),
  maxEnrollment: integer("max_enrollment").default(30),
  providesCertification: boolean("provides_certification").default(false),
  certificationName: varchar("certification_name", { length: 200 }),
  certificationValidYears: integer("certification_valid_years"),
  clcApproved: boolean("clc_approved").default(false),
  clcApprovalDate: date("clc_approval_date"),
  clcCourseCode: varchar("clc_course_code", { length: 50 }),
  courseFee: numeric("course_fee", { precision: 10, scale: 2 }).default('0.00'),
  materialsFee: numeric("materials_fee", { precision: 10, scale: 2 }).default('0.00'),
  travelSubsidyAvailable: boolean("travel_subsidy_available").default(false),
  isActive: boolean("is_active").default(true),
  isMandatory: boolean("is_mandatory").default(false),
  mandatoryForRoles: jsonb("mandatory_for_roles"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  createdBy: varchar("created_by", { length: 255 }),
},
(table) => {
  return {
    idxTrainingCoursesActive: index("idx_training_courses_active").using("btree", table.isActive.asc().nullsLast()),
    idxTrainingCoursesCategory: index("idx_training_courses_category").using("btree", table.courseCategory.asc().nullsLast()),
    idxTrainingCoursesClc: index("idx_training_courses_clc").using("btree", table.clcApproved.asc().nullsLast()),
    idxTrainingCoursesOrg: index("idx_training_courses_org").using("btree", table.organizationId.asc().nullsLast()),
    trainingCoursesOrganizationIdFkey: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: "training_courses_organization_id_fkey"
    }),
    trainingCoursesCourseCodeKey: unique("training_courses_course_code_key").on(table.courseCode),
  }
});

// Course Sessions Table
export const courseSessions = pgTable("course_sessions", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  organizationId: uuid("organization_id").notNull(),
  courseId: uuid("course_id").notNull(),
  sessionCode: varchar("session_code", { length: 50 }).notNull(),
  sessionName: varchar("session_name", { length: 300 }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  sessionTimes: jsonb("session_times"),
  deliveryMethod: varchar("delivery_method", { length: 50 }).notNull(),
  venueName: varchar("venue_name", { length: 200 }),
  venueAddress: text("venue_address"),
  roomNumber: varchar("room_number", { length: 50 }),
  virtualMeetingUrl: text("virtual_meeting_url"),
  virtualMeetingAccessCode: varchar("virtual_meeting_access_code", { length: 50 }),
  leadInstructorId: varchar("lead_instructor_id", { length: 255 }),
  leadInstructorName: varchar("lead_instructor_name", { length: 200 }),
  coInstructors: jsonb("co_instructors"),
  registrationOpenDate: date("registration_open_date"),
  registrationCloseDate: date("registration_close_date"),
  registrationCount: integer("registration_count").default(0),
  waitlistCount: integer("waitlist_count").default(0),
  maxEnrollment: integer("max_enrollment"),
  sessionStatus: varchar("session_status", { length: 50 }).default('scheduled'),
  attendeesCount: integer("attendees_count").default(0),
  completionsCount: integer("completions_count").default(0),
  completionRate: numeric("completion_rate", { precision: 5, scale: 2 }),
  averageRating: numeric("average_rating", { precision: 3, scale: 2 }),
  evaluationResponsesCount: integer("evaluation_responses_count").default(0),
  sessionBudget: numeric("session_budget", { precision: 10, scale: 2 }),
  actualCost: numeric("actual_cost", { precision: 10, scale: 2 }),
  travelSubsidyOffered: boolean("travel_subsidy_offered").default(false),
  accommodationArranged: boolean("accommodation_arranged").default(false),
  accommodationHotel: varchar("accommodation_hotel", { length: 200 }),
  materialsPrepared: boolean("materials_prepared").default(false),
  materialsDistributedCount: integer("materials_distributed_count").default(0),
  cancellationReason: text("cancellation_reason"),
  cancelledDate: date("cancelled_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  createdBy: varchar("created_by", { length: 255 }),
},
(table) => {
  return {
    idxCourseSessionsCourse: index("idx_course_sessions_course").using("btree", table.courseId.asc().nullsLast()),
    idxCourseSessionsDates: index("idx_course_sessions_dates").using("btree", table.startDate.asc().nullsLast(), table.endDate.asc().nullsLast()),
    idxCourseSessionsInstructor: index("idx_course_sessions_instructor").using("btree", table.leadInstructorId.asc().nullsLast()),
    idxCourseSessionsOrg: index("idx_course_sessions_org").using("btree", table.organizationId.asc().nullsLast()),
    idxCourseSessionsStatus: index("idx_course_sessions_status").using("btree", table.sessionStatus.asc().nullsLast()),
    courseSessionsCourseIdFkey: foreignKey({
      columns: [table.courseId],
      foreignColumns: [trainingCourses.id],
      name: "course_sessions_course_id_fkey"
    }),
    courseSessionsOrganizationIdFkey: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: "course_sessions_organization_id_fkey"
    }),
    courseSessionsSessionCodeKey: unique("course_sessions_session_code_key").on(table.sessionCode),
  }
});

// Course Registrations Table
export const courseRegistrations = pgTable("course_registrations", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  organizationId: uuid("organization_id").notNull(),
  memberId: varchar("member_id", { length: 255 }).notNull(),
  courseId: uuid("course_id").notNull(),
  sessionId: uuid("session_id").notNull(),
  registrationDate: timestamp("registration_date", { withTimezone: true, mode: 'string' }).defaultNow(),
  registrationStatus: varchar("registration_status", { length: 50 }).default('registered'),
  requiresApproval: boolean("requires_approval").default(false),
  approvedBy: varchar("approved_by", { length: 255 }),
  approvedDate: date("approved_date"),
  approvalNotes: text("approval_notes"),
  attended: boolean("attended").default(false),
  attendanceDates: jsonb("attendance_dates"),
  attendanceHours: numeric("attendance_hours", { precision: 5, scale: 2 }),
  completed: boolean("completed").default(false),
  completionDate: date("completion_date"),
  completionPercentage: numeric("completion_percentage", { precision: 5, scale: 2 }).default('0.00'),
  preTestScore: numeric("pre_test_score", { precision: 5, scale: 2 }),
  postTestScore: numeric("post_test_score", { precision: 5, scale: 2 }),
  finalGrade: varchar("final_grade", { length: 10 }),
  passed: boolean("passed"),
  certificateIssued: boolean("certificate_issued").default(false),
  certificateNumber: varchar("certificate_number", { length: 100 }),
  certificateIssueDate: date("certificate_issue_date"),
  certificateUrl: text("certificate_url"),
  evaluationCompleted: boolean("evaluation_completed").default(false),
  evaluationRating: numeric("evaluation_rating", { precision: 3, scale: 2 }),
  evaluationComments: text("evaluation_comments"),
  evaluationSubmittedDate: date("evaluation_submitted_date"),
  travelRequired: boolean("travel_required").default(false),
  travelSubsidyRequested: boolean("travel_subsidy_requested").default(false),
  travelSubsidyApproved: boolean("travel_subsidy_approved").default(false),
  travelSubsidyAmount: numeric("travel_subsidy_amount", { precision: 10, scale: 2 }),
  accommodationRequired: boolean("accommodation_required").default(false),
  courseFee: numeric("course_fee", { precision: 10, scale: 2 }).default('0.00'),
  feePaid: boolean("fee_paid").default(false),
  feePaymentDate: date("fee_payment_date"),
  feeWaived: boolean("fee_waived").default(false),
  feeWaiverReason: text("fee_waiver_reason"),
  cancellationDate: date("cancellation_date"),
  cancellationReason: text("cancellation_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
  return {
    idxCourseRegistrationsCompleted: index("idx_course_registrations_completed").using("btree", table.completed.asc().nullsLast()),
    idxCourseRegistrationsCourse: index("idx_course_registrations_course").using("btree", table.courseId.asc().nullsLast()),
    idxCourseRegistrationsMember: index("idx_course_registrations_member").using("btree", table.memberId.asc().nullsLast()),
    idxCourseRegistrationsOrg: index("idx_course_registrations_org").using("btree", table.organizationId.asc().nullsLast()),
    idxCourseRegistrationsSession: index("idx_course_registrations_session").using("btree", table.sessionId.asc().nullsLast()),
    idxCourseRegistrationsStatus: index("idx_course_registrations_status").using("btree", table.registrationStatus.asc().nullsLast()),
    courseRegistrationsCourseIdFkey: foreignKey({
      columns: [table.courseId],
      foreignColumns: [trainingCourses.id],
      name: "course_registrations_course_id_fkey"
    }),
    courseRegistrationsOrganizationIdFkey: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: "course_registrations_organization_id_fkey"
    }),
    courseRegistrationsSessionIdFkey: foreignKey({
      columns: [table.sessionId],
      foreignColumns: [courseSessions.id],
      name: "course_registrations_session_id_fkey"
    }),
  }
});

// Member Certifications Table
export const memberCertifications = pgTable("member_certifications", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  organizationId: uuid("organization_id").notNull(),
  memberId: varchar("member_id", { length: 255 }).notNull(),
  certificationName: varchar("certification_name", { length: 200 }).notNull(),
  certificationType: varchar("certification_type", { length: 100 }),
  issuedByOrganization: varchar("issued_by_organization", { length: 200 }),
  certificationNumber: varchar("certification_number", { length: 100 }),
  issueDate: date("issue_date").notNull(),
  expiryDate: date("expiry_date"),
  validYears: integer("valid_years"),
  certificationStatus: varchar("certification_status", { length: 50 }).default('active'),
  courseId: uuid("course_id"),
  sessionId: uuid("session_id"),
  registrationId: uuid("registration_id"),
  renewalRequired: boolean("renewal_required").default(false),
  renewalDate: date("renewal_date"),
  renewalCourseId: uuid("renewal_course_id"),
  verified: boolean("verified").default(true),
  verificationDate: date("verification_date"),
  verifiedBy: varchar("verified_by", { length: 255 }),
  certificateUrl: text("certificate_url"),
  digitalBadgeUrl: text("digital_badge_url"),
  clcRegistered: boolean("clc_registered").default(false),
  clcRegistrationNumber: varchar("clc_registration_number", { length: 100 }),
  clcRegistrationDate: date("clc_registration_date"),
  revoked: boolean("revoked").default(false),
  revocationDate: date("revocation_date"),
  revocationReason: text("revocation_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
  return {
    idxMemberCertificationsExpiry: index("idx_member_certifications_expiry").using("btree", table.expiryDate.asc().nullsLast()),
    idxMemberCertificationsMember: index("idx_member_certifications_member").using("btree", table.memberId.asc().nullsLast()),
    idxMemberCertificationsOrg: index("idx_member_certifications_org").using("btree", table.organizationId.asc().nullsLast()),
    idxMemberCertificationsStatus: index("idx_member_certifications_status").using("btree", table.certificationStatus.asc().nullsLast()),
    idxMemberCertificationsType: index("idx_member_certifications_type").using("btree", table.certificationType.asc().nullsLast()),
    memberCertificationsCourseIdFkey: foreignKey({
      columns: [table.courseId],
      foreignColumns: [trainingCourses.id],
      name: "member_certifications_course_id_fkey"
    }),
    memberCertificationsOrganizationIdFkey: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: "member_certifications_organization_id_fkey"
    }),
    memberCertificationsRegistrationIdFkey: foreignKey({
      columns: [table.registrationId],
      foreignColumns: [courseRegistrations.id],
      name: "member_certifications_registration_id_fkey"
    }),
    memberCertificationsRenewalCourseIdFkey: foreignKey({
      columns: [table.renewalCourseId],
      foreignColumns: [trainingCourses.id],
      name: "member_certifications_renewal_course_id_fkey"
    }),
    memberCertificationsSessionIdFkey: foreignKey({
      columns: [table.sessionId],
      foreignColumns: [courseSessions.id],
      name: "member_certifications_session_id_fkey"
    }),
    memberCertificationsCertificationNumberKey: unique("member_certifications_certification_number_key").on(table.certificationNumber),
  }
});

// Training Programs Table
export const trainingPrograms = pgTable("training_programs", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  organizationId: uuid("organization_id").notNull(),
  programName: varchar("program_name", { length: 200 }).notNull(),
  programDescription: text("program_description"),
  programDuration: varchar("program_duration", { length: 100 }),
  requiredCourses: jsonb("required_courses"),
  electiveCourses: jsonb("elective_courses"),
  minimumRequiredCourses: integer("minimum_required_courses"),
  minimumElectiveCourses: integer("minimum_elective_courses"),
  providesCertification: boolean("provides_certification").default(false),
  certificationName: varchar("certification_name", { length: 200 }),
  clcApproved: boolean("clc_approved").default(false),
  clcApprovalDate: date("clc_approval_date"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  createdBy: varchar("created_by", { length: 255 }),
},
(table) => {
  return {
    idxTrainingProgramsActive: index("idx_training_programs_active").using("btree", table.isActive.asc().nullsLast()),
    idxTrainingProgramsOrg: index("idx_training_programs_org").using("btree", table.organizationId.asc().nullsLast()),
    trainingProgramsOrganizationIdFkey: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: "training_programs_organization_id_fkey"
    }),
  }
});

// Program Enrollments Table
export const programEnrollments = pgTable("program_enrollments", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  organizationId: uuid("organization_id").notNull(),
  memberId: varchar("member_id", { length: 255 }).notNull(),
  programId: uuid("program_id").notNull(),
  enrollmentDate: date("enrollment_date").notNull(),
  enrollmentStatus: varchar("enrollment_status", { length: 50 }).default('enrolled'),
  coursesCompleted: jsonb("courses_completed"),
  coursesCompletedCount: integer("courses_completed_count").default(0),
  electivesCompletedCount: integer("electives_completed_count").default(0),
  progressPercentage: numeric("progress_percentage", { precision: 5, scale: 2 }).default('0.00'),
  completed: boolean("completed").default(false),
  completionDate: date("completion_date"),
  certificationId: uuid("certification_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
  return {
    idxProgramEnrollmentsMember: index("idx_program_enrollments_member").using("btree", table.memberId.asc().nullsLast()),
    idxProgramEnrollmentsOrg: index("idx_program_enrollments_org").using("btree", table.organizationId.asc().nullsLast()),
    idxProgramEnrollmentsProgram: index("idx_program_enrollments_program").using("btree", table.programId.asc().nullsLast()),
    idxProgramEnrollmentsStatus: index("idx_program_enrollments_status").using("btree", table.enrollmentStatus.asc().nullsLast()),
    programEnrollmentsCertificationIdFkey: foreignKey({
      columns: [table.certificationId],
      foreignColumns: [memberCertifications.id],
      name: "program_enrollments_certification_id_fkey"
    }),
    programEnrollmentsOrganizationIdFkey: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: "program_enrollments_organization_id_fkey"
    }),
    programEnrollmentsProgramIdFkey: foreignKey({
      columns: [table.programId],
      foreignColumns: [trainingPrograms.id],
      name: "program_enrollments_program_id_fkey"
    }),
  }
});

// Relations
export const trainingCoursesRelations = relations(trainingCourses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [trainingCourses.organizationId],
    references: [organizations.id],
  }),
  sessions: many(courseSessions),
  certifications: many(memberCertifications),
}));

export const courseSessionsRelations = relations(courseSessions, ({ one, many }) => ({
  course: one(trainingCourses, {
    fields: [courseSessions.courseId],
    references: [trainingCourses.id],
  }),
  organization: one(organizations, {
    fields: [courseSessions.organizationId],
    references: [organizations.id],
  }),
  registrations: many(courseRegistrations),
}));

export const courseRegistrationsRelations = relations(courseRegistrations, ({ one }) => ({
  course: one(trainingCourses, {
    fields: [courseRegistrations.courseId],
    references: [trainingCourses.id],
  }),
  session: one(courseSessions, {
    fields: [courseRegistrations.sessionId],
    references: [courseSessions.id],
  }),
  organization: one(organizations, {
    fields: [courseRegistrations.organizationId],
    references: [organizations.id],
  }),
}));

export const memberCertificationsRelations = relations(memberCertifications, ({ one }) => ({
  course: one(trainingCourses, {
    fields: [memberCertifications.courseId],
    references: [trainingCourses.id],
  }),
  session: one(courseSessions, {
    fields: [memberCertifications.sessionId],
    references: [courseSessions.id],
  }),
  registration: one(courseRegistrations, {
    fields: [memberCertifications.registrationId],
    references: [courseRegistrations.id],
  }),
}));

export const trainingProgramsRelations = relations(trainingPrograms, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [trainingPrograms.organizationId],
    references: [organizations.id],
  }),
  enrollments: many(programEnrollments),
}));

export const programEnrollmentsRelations = relations(programEnrollments, ({ one }) => ({
  program: one(trainingPrograms, {
    fields: [programEnrollments.programId],
    references: [trainingPrograms.id],
  }),
  organization: one(organizations, {
    fields: [programEnrollments.organizationId],
    references: [organizations.id],
  }),
  certification: one(memberCertifications, {
    fields: [programEnrollments.certificationId],
    references: [memberCertifications.id],
  }),
}));

