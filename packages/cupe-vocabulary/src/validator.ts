/**
 * Vocabulary Validation
 * 
 * Validates that provided terminology values conform to CUPE vocabulary standards.
 */

import { z } from 'zod';
import { getAllCaseTypeIds, getAllPriorityIds, getAllStatusIds } from './vocabulary';
import { VocabularyValidationError } from './types';

/**
 * Case Type Validator
 */
export const CaseTypeValidator = z.enum(
  getAllCaseTypeIds() as [string, ...string[]]
);

/**
 * Priority Validator
 */
export const PriorityValidator = z.enum(
  getAllPriorityIds() as [string, ...string[]]
);

/**
 * Status Validator
 */
export const StatusValidator = z.enum(
  getAllStatusIds() as [string, ...string[]]
);

/**
 * Validate a case type ID against CUPE vocabulary.
 */
export function validateCaseType(caseTypeId: unknown): { valid: boolean; error?: VocabularyValidationError } {
  try {
    CaseTypeValidator.parse(caseTypeId);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: {
        field: 'caseType',
        value: caseTypeId,
        message: `Invalid case type. Must be one of: ${getAllCaseTypeIds().join(', ')}`,
      },
    };
  }
}

/**
 * Validate a priority ID against CUPE vocabulary.
 */
export function validatePriority(priorityId: unknown): { valid: boolean; error?: VocabularyValidationError } {
  try {
    PriorityValidator.parse(priorityId);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: {
        field: 'priority',
        value: priorityId,
        message: `Invalid priority. Must be one of: ${getAllPriorityIds().join(', ')}`,
      },
    };
  }
}

/**
 * Validate a status ID against CUPE vocabulary.
 */
export function validateStatus(statusId: unknown): { valid: boolean; error?: VocabularyValidationError } {
  try {
    StatusValidator.parse(statusId);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: {
        field: 'status',
        value: statusId,
        message: `Invalid status. Must be one of: ${getAllStatusIds().join(', ')}`,
      },
    };
  }
}

/**
 * Validate all vocabulary fields for a case intake.
 */
export function validateCaseIntake(data: {
  caseType?: unknown;
  priority?: unknown;
  status?: unknown;
}): { valid: boolean; errors: VocabularyValidationError[] } {
  const errors: VocabularyValidationError[] = [];

  if (data.caseType) {
    const caseTypeResult = validateCaseType(data.caseType);
    if (!caseTypeResult.valid && caseTypeResult.error) {
      errors.push(caseTypeResult.error);
    }
  }

  if (data.priority) {
    const priorityResult = validatePriority(data.priority);
    if (!priorityResult.valid && priorityResult.error) {
      errors.push(priorityResult.error);
    }
  }

  if (data.status) {
    const statusResult = validateStatus(data.status);
    if (!statusResult.valid && statusResult.error) {
      errors.push(statusResult.error);
    }
  }

  return { valid: errors.length === 0, errors };
}
