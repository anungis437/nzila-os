/**
 * Quebec Vocabulary Validation
 * 
 * Validates terminology values against Quebec vocabulary standards.
 */

import { z } from 'zod';
import { getAllCaseTypeIds, getAllPriorityIds, getAllStatusIds, getAllRoleIds } from './vocabulary';
import { VocabularyValidationError } from './types';

export const QCCaseTypeValidator = z.enum(
  getAllCaseTypeIds() as [string, ...string[]]
);

export const QCPriorityValidator = z.enum(
  getAllPriorityIds() as [string, ...string[]]
);

export const QCStatusValidator = z.enum(
  getAllStatusIds() as [string, ...string[]]
);

export const QCRoleValidator = z.enum(
  getAllRoleIds() as [string, ...string[]]
);

export function validateCaseType(caseTypeId: unknown): { valid: boolean; error?: VocabularyValidationError } {
  try {
    QCCaseTypeValidator.parse(caseTypeId);
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: {
        field: 'caseType',
        value: caseTypeId,
        message: `Type de grief invalide. Les valeurs acceptées sont : ${getAllCaseTypeIds().join(', ')}`,
      },
    };
  }
}

export function validatePriority(priorityId: unknown): { valid: boolean; error?: VocabularyValidationError } {
  try {
    QCPriorityValidator.parse(priorityId);
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: {
        field: 'priority',
        value: priorityId,
        message: `Priorité invalide. Les valeurs acceptées sont : ${getAllPriorityIds().join(', ')}`,
      },
    };
  }
}

export function validateStatus(statusId: unknown): { valid: boolean; error?: VocabularyValidationError } {
  try {
    QCStatusValidator.parse(statusId);
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: {
        field: 'status',
        value: statusId,
        message: `Statut invalide. Les valeurs acceptées sont : ${getAllStatusIds().join(', ')}`,
      },
    };
  }
}

export function validateGriefIntake(data: {
  caseType?: unknown;
  priority?: unknown;
  status?: unknown;
}): { valid: boolean; errors: VocabularyValidationError[] } {
  const errors: VocabularyValidationError[] = [];

  if (data.caseType) {
    const r = validateCaseType(data.caseType);
    if (!r.valid && r.error) errors.push(r.error);
  }
  if (data.priority) {
    const r = validatePriority(data.priority);
    if (!r.valid && r.error) errors.push(r.error);
  }
  if (data.status) {
    const r = validateStatus(data.status);
    if (!r.valid && r.error) errors.push(r.error);
  }

  return { valid: errors.length === 0, errors };
}
