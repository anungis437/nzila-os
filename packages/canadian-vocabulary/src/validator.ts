/**
 * Canadian Vocabulary Validation
 *
 * Validates terminology values against the Canadian vocabulary standards
 * for any jurisdiction.
 */

import { z } from 'zod';
import { getCaseTypeIds, getPriorityIds, getStatusIds, getRoleIds, getAllJurisdictions } from './vocabulary';
import type { CanadianJurisdiction, VocabularyValidationError } from './types';

export const JurisdictionValidator = z.enum(
  getAllJurisdictions() as [string, ...string[]]
);

export function createCaseTypeValidator(jurisdiction: CanadianJurisdiction) {
  return z.enum(getCaseTypeIds(jurisdiction) as [string, ...string[]]);
}

export const PriorityValidator = z.enum(
  getPriorityIds() as [string, ...string[]]
);

export const StatusValidator = z.enum(
  getStatusIds() as [string, ...string[]]
);

export const RoleValidator = z.enum(
  getRoleIds() as [string, ...string[]]
);

export function validateCaseType(
  jurisdiction: CanadianJurisdiction,
  caseTypeId: unknown,
): { valid: boolean; error?: VocabularyValidationError } {
  try {
    createCaseTypeValidator(jurisdiction).parse(caseTypeId);
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: {
        field: 'caseType',
        value: caseTypeId,
        message: `Invalid case type. Accepted values for ${jurisdiction}: ${getCaseTypeIds(jurisdiction).join(', ')}`,
      },
    };
  }
}

export function validatePriority(priorityId: unknown): { valid: boolean; error?: VocabularyValidationError } {
  try {
    PriorityValidator.parse(priorityId);
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: {
        field: 'priority',
        value: priorityId,
        message: `Invalid priority. Accepted values: ${getPriorityIds().join(', ')}`,
      },
    };
  }
}

export function validateStatus(statusId: unknown): { valid: boolean; error?: VocabularyValidationError } {
  try {
    StatusValidator.parse(statusId);
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: {
        field: 'status',
        value: statusId,
        message: `Invalid status. Accepted values: ${getStatusIds().join(', ')}`,
      },
    };
  }
}

export function validateGrievanceIntake(
  jurisdiction: CanadianJurisdiction,
  data: { caseType?: unknown; priority?: unknown; status?: unknown },
): { valid: boolean; errors: VocabularyValidationError[] } {
  const errors: VocabularyValidationError[] = [];

  if (data.caseType !== undefined) {
    const result = validateCaseType(jurisdiction, data.caseType);
    if (!result.valid && result.error) errors.push(result.error);
  }
  if (data.priority !== undefined) {
    const result = validatePriority(data.priority);
    if (!result.valid && result.error) errors.push(result.error);
  }
  if (data.status !== undefined) {
    const result = validateStatus(data.status);
    if (!result.valid && result.error) errors.push(result.error);
  }

  return { valid: errors.length === 0, errors };
}
