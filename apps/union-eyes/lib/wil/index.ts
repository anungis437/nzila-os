/**
 * WIL Integration — Barrel Export
 *
 * Central entry point for all Workload Intelligence Layer integration
 * within union-eyes.
 */

export {
  toAuthorityRole,
  userCanCreateOfficialWorkItem,
  userCanConvertIntake,
  userCanAssignPriority,
  userCanOverridePriority,
  userCanCreateIntake,
} from './authority';

export { createWorkItemSource, createIntakeSource } from './adapters';
