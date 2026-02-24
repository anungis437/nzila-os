/**
 * CLC Remittance Validation Utilities
 * 
 * Validates remittance data before export to ensure:
 * - Data completeness and accuracy
 * - Format compliance with CLC standards
 * - StatCan reporting requirements
 * - Financial accuracy (amounts, rates, calculations)
 * 
 * @module services/clc/remittance-validation
 */

import { z } from 'zod';

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Remittance record schema for validation
 */
export const RemittanceRecordSchema = z.object({
  id: z.string().uuid('Invalid remittance ID format'),
  fromOrgId: z.string().uuid('Invalid from organization ID'),
  fromOrgName: z.string().min(1, 'From organization name required'),
  fromOrgCode: z.string().regex(/^[A-Z0-9-]+$/, 'Invalid organization code format'),
  toOrgId: z.string().uuid('Invalid to organization ID'),
  toOrgName: z.string().min(1, 'To organization name required'),
  toOrgCode: z.string().regex(/^[A-Z0-9-]+$/, 'Invalid parent organization code format'),
  periodStart: z.date(),
  periodEnd: z.date(),
  remittableMembers: z.number().int().min(0, 'Remittable members must be non-negative'),
  perCapitaRate: z.string().regex(/^\d+\.\d{2}$/, 'Per-capita rate must be in format XX.XX'),
  totalAmount: z.string().regex(/^\d+\.\d{2}$/, 'Total amount must be in format XX.XX'),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']),
  dueDate: z.date(),
  paidDate: z.date().optional(),
  clcAccountCode: z.string().optional(),
  glAccount: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * CLC organization code format
 */
const CLC_CODE_PATTERN = /^[A-Z]{2,4}-\d{3,5}$/;

/**
 * StatCan organization code format
 */
const STATCAN_CODE_PATTERN = /^[A-Z0-9]{1,10}$/;

/**
 * Remittance Validation Service
 */
export class RemittanceValidationService {
  
  /**
   * Validate single remittance record
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validateRecord(record: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Schema validation
    const schemaResult = RemittanceRecordSchema.safeParse(record);
    if (!schemaResult.success) {
      for (const issue of schemaResult.error.issues) {
        errors.push({
          field: issue.path.join('.'),
          message: issue.message,
          severity: 'error',
          value: record[issue.path[0]],
        });
      }
    }

    // Business logic validation
    if (record.periodEnd && record.periodStart) {
      if (record.periodEnd <= record.periodStart) {
        errors.push({
          field: 'periodEnd',
          message: 'Period end must be after period start',
          severity: 'error',
        });
      }
    }

    // Amount calculation validation
    if (record.remittableMembers && record.perCapitaRate) {
      const expectedAmount = (record.remittableMembers * parseFloat(record.perCapitaRate)).toFixed(2);
      if (expectedAmount !== record.totalAmount) {
        errors.push({
          field: 'totalAmount',
          message: `Total amount mismatch. Expected ${expectedAmount}, got ${record.totalAmount}`,
          severity: 'error',
          value: record.totalAmount,
        });
      }
    }

    // Due date validation
    if (record.dueDate && record.periodEnd) {
      if (record.dueDate < record.periodEnd) {
        warnings.push({
          field: 'dueDate',
          message: 'Due date is before period end',
          severity: 'warning',
        });
      }
    }

    // Paid date validation
    if (record.status === 'paid' && !record.paidDate) {
      errors.push({
        field: 'paidDate',
        message: 'Paid date required when status is paid',
        severity: 'error',
      });
    }

    // Zero amount warning
    if (parseFloat(record.totalAmount || '0') === 0) {
      warnings.push({
        field: 'totalAmount',
        message: 'Total amount is zero',
        severity: 'warning',
        value: record.totalAmount,
      });
    }

    // Zero members warning
    if (record.remittableMembers === 0) {
      warnings.push({
        field: 'remittableMembers',
        message: 'No remittable members',
        severity: 'warning',
        value: 0,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate batch of remittance records
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validateBatch(records: any[]): ValidationResult {
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationError[] = [];

    for (let i = 0; i < records.length; i++) {
      const result = this.validateRecord(records[i]);
      
      // Prefix field names with record index
      for (const error of result.errors) {
        allErrors.push({
          ...error,
          field: `record[${i}].${error.field}`,
        });
      }
      
      for (const warning of result.warnings) {
        allWarnings.push({
          ...warning,
          field: `record[${i}].${warning.field}`,
        });
      }
    }

    // Batch-level validations
    if (records.length === 0) {
      allErrors.push({
        field: 'batch',
        message: 'No records to export',
        severity: 'error',
      });
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Validate CLC export format compliance
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validateCLCFormat(record: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // CLC organization code format
    if (record.fromOrgCode && !CLC_CODE_PATTERN.test(record.fromOrgCode)) {
      warnings.push({
        field: 'fromOrgCode',
        message: 'Organization code does not match CLC standard format (XX-XXXX)',
        severity: 'warning',
        value: record.fromOrgCode,
      });
    }

    if (record.toOrgCode && !CLC_CODE_PATTERN.test(record.toOrgCode)) {
      warnings.push({
        field: 'toOrgCode',
        message: 'Parent organization code does not match CLC standard format',
        severity: 'warning',
        value: record.toOrgCode,
      });
    }

    // CLC account code
    if (!record.clcAccountCode) {
      warnings.push({
        field: 'clcAccountCode',
        message: 'CLC account code not specified',
        severity: 'warning',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate StatCan export format compliance
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validateStatCanFormat(record: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // StatCan organization code format
    if (record.fromOrgCode && !STATCAN_CODE_PATTERN.test(record.fromOrgCode)) {
      errors.push({
        field: 'fromOrgCode',
        message: 'Organization code does not match StatCan format (alphanumeric, max 10 chars)',
        severity: 'error',
        value: record.fromOrgCode,
      });
    }

    // Required fields for StatCan
    const requiredFields = [
      'fromOrgCode',
      'fromOrgName',
      'toOrgCode',
      'toOrgName',
      'remittableMembers',
      'totalAmount',
    ];

    for (const field of requiredFields) {
      if (!record[field]) {
        errors.push({
          field,
          message: `${field} is required for StatCan reporting`,
          severity: 'error',
        });
      }
    }

    // Member count must be positive
    if (record.remittableMembers <= 0) {
      errors.push({
        field: 'remittableMembers',
        message: 'Member count must be positive for StatCan reporting',
        severity: 'error',
        value: record.remittableMembers,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Format validation errors as readable message
   */
  formatValidationErrors(result: ValidationResult): string {
    const messages: string[] = [];

    if (result.errors.length > 0) {
      messages.push('ERRORS:');
      for (const error of result.errors) {
        messages.push(`  - ${error.field}: ${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      messages.push('WARNINGS:');
      for (const warning of result.warnings) {
        messages.push(`  - ${warning.field}: ${warning.message}`);
      }
    }

    return messages.join('\n');
  }
}

/**
 * Create singleton instance
 */
export const remittanceValidator = new RemittanceValidationService();
