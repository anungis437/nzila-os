/**
 * Request Input Validation Middleware
 * 
 * Provides:
 * - Zod-based schema validation for request bodies
 * - Query parameter validation
 * - Request body sanitization
 * - Type-safe error handling
 * 
 * Usage:
 *   import { validateRequest, createValidator } from '@/lib/middleware/request-validation';
 *   import { z } from 'zod';
 *   
 *   const schema = z.object({
 *     email: z.string().email(),
 *     age: z.number().int().positive(),
 *   });
 *   
 *   const result = await validateRequest(request, schema);
 *   if (!result.isValid) return NextResponse.json(result.errors, { status: 400 });
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema, ZodError } from 'zod';

/**
 * Validation result union type
 */
export type ValidationResult<T> = 
  | { isValid: true; data: T }
  | { isValid: false; errors: Record<string, string[]> };

/**
 * Request validation error details
 */
interface _ValidationErrorDetail {
  field: string;
  message: string;
  received?: unknown;
  expected?: string;
}

/**
 * Sanitization rules
 */
const sanitizationRules = {
  /**
   * Trim whitespace and truncate to max length
   */
  string: (value: unknown, maxLength: number = 1000): string => {
    if (typeof value !== 'string') return '';
    return value.trim().substring(0, maxLength);
  },

  /**
   * Validate email format
   */
  email: (value: unknown): string => {
    if (typeof value !== 'string') throw new Error('Email must be string');
    const sanitized = value.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitized)) {
      throw new Error('Invalid email format');
    }
    return sanitized;
  },

  /**
   * Remove HTML/script tags from string
   */
  html: (value: unknown): string => {
    if (typeof value !== 'string') return '';
    // Remove HTML tags
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  },

  /**
   * Validate URL format and prevent javascript: URIs
   */
  url: (value: unknown): string => {
    if (typeof value !== 'string') throw new Error('URL must be string');
    const trimmed = value.trim();
    
    // Reject javascript: and data: URIs
    if (trimmed.toLowerCase().startsWith('javascript:') || 
        trimmed.toLowerCase().startsWith('data:')) {
      throw new Error('Invalid URL protocol');
    }

    try {
      new URL(trimmed);
    } catch {
      throw new Error('Invalid URL format');
    }

    return trimmed;
  },

  /**
   * Validate UUID format
   */
  uuid: (value: unknown): string => {
    if (typeof value !== 'string') throw new Error('UUID must be string');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error('Invalid UUID format');
    }
    return value.toLowerCase();
  },

  /**
   * Sanitize phone numbers - remove non-digits except leading +
   */
  phone: (value: unknown): string => {
    if (typeof value !== 'string') throw new Error('Phone must be string');
    const sanitized = value.replace(/[^\d+]/g, '');
    if (sanitized.length < 10) {
      throw new Error('Invalid phone number');
    }
    return sanitized;
  },

  /**
   * Validate numeric values
   */
  number: (value: unknown, min?: number, max?: number): number => {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) throw new Error('Invalid number');
    if (min !== undefined && num < min) throw new Error(`Must be >= ${min}`);
    if (max !== undefined && num > max) throw new Error(`Must be <= ${max}`);
    return num;
  },

  /**
   * Validate integer values
   */
  integer: (value: unknown, min?: number, max?: number): number => {
    const num = sanitizationRules.number(value, min, max);
    if (!Number.isInteger(num)) throw new Error('Must be integer');
    return num;
  },

  /**
   * Validate enum values
   */
  enum: (value: unknown, allowedValues: string[]): string => {
    const strValue = String(value);
    if (!allowedValues.includes(strValue)) {
      throw new Error(`Must be one of: ${allowedValues.join(', ')}`);
    }
    return strValue;
  },
};

/**
 * Request validator class
 */
export class RequestValidator {
  /**
   * Validate request body against Zod schema
   */
  static async validateBody<T extends ZodSchema>(
    request: NextRequest | Request,
    schema: T
  ): Promise<ValidationResult<z.infer<T>>> {
    try {
      let body;
      try {
        body = await request.json();
      } catch {
        return {
          isValid: false,
          errors: { '_body': ['Invalid JSON in request body'] }
        };
      }

      const result = schema.safeParse(body);

      if (!result.success) {
        return {
          isValid: false,
          errors: this.formatZodErrors(result.error)
        };
      }

      return { isValid: true, data: result.data };
    } catch (error) {
      return {
        isValid: false,
        errors: { '_error': [error instanceof Error ? error.message : 'Validation error'] }
      };
    }
  }

  /**
   * Validate query parameters against Zod schema
   */
  static validateQuery<T extends ZodSchema>(
    searchParams: URLSearchParams | Record<string, string>,
    schema: T
  ): ValidationResult<z.infer<T>> {
    try {
      const params = searchParams instanceof URLSearchParams
        ? Object.fromEntries(searchParams)
        : searchParams;

      const result = schema.safeParse(params);

      if (!result.success) {
        return {
          isValid: false,
          errors: this.formatZodErrors(result.error)
        };
      }

      return { isValid: true, data: result.data };
    } catch (error) {
      return {
        isValid: false,
        errors: { '_error': [error instanceof Error ? error.message : 'Validation error'] }
      };
    }
  }

  /**
   * Format Zod validation errors into readable format
   */
  static formatZodErrors(error: ZodError): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    error.errors.forEach(err => {
      const path = err.path.join('.');
      const message = err.message;

      if (!errors[path]) {
        errors[path] = [];
      }

      errors[path].push(message);
    });

    return errors;
  }

  /**
   * Create response for validation errors
   */
  static errorResponse(errors: Record<string, string[]>, statusCode: number = 400) {
    return NextResponse.json(
      {
        isValid: false,
        errors,
        message: 'Validation failed - please check your input'
      },
      { status: statusCode }
    );
  }

  /**
   * Sanitize object values
   */
  static sanitize<T extends Record<string, unknown>>(
    data: T,
    rules: Record<string, (val: unknown) => unknown>
  ): T {
    const sanitized = { ...data };

    Object.entries(rules).forEach(([key, rule]) => {
      if (key in sanitized) {
        try {
          sanitized[key as keyof T] = rule(sanitized[key as keyof T]) as never;
        } catch (_error) {
}
      }
    });

    return sanitized;
  }
}

/**
 * Create pre-configured validator for common patterns
 */
export const createValidator = {
  /**
   * Email validation
   */
  email: () => z.string()
    .email('Invalid email format')
    .trim()
    .toLowerCase()
    .max(255, 'Email too long'),

  /**
   * Password validation
   */
  password: (options?: { minLength?: number; requireSpecialChars?: boolean }) => 
    z.string()
      .min(options?.minLength ?? 8, 'Password must be at least 8 characters')
      .max(128, 'Password too long')
      .refine(
        (val) => !options?.requireSpecialChars || /[!@#$%^&*]/.test(val),
        'Password must contain at least one special character'
      ),

  /**
   * UUID validation
   */
  uuid: () => z.string().uuid('Invalid UUID format'),

  /**
   * URL validation
   */
  url: () => z.string()
    .url('Invalid URL')
    .refine(
      (val) => !val.toLowerCase().startsWith('javascript:'),
      'Invalid URL protocol'
    ),

  /**
   * Phone number validation
   */
  phone: (format: 'US' | 'INTL' = 'US') => {
    if (format === 'US') {
      return z.string()
        .regex(/^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/, 'Invalid US phone format');
    }
    return z.string()
      .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid international phone format');
  },

  /**
   * Slug validation
   */
  slug: () => z.string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format (lowercase alphanumeric with hyphens)')
    .max(100, 'Slug too long'),

  /**
   * Authorization header
   */
  authHeader: () => z.string()
    .startsWith('Bearer ', 'Authorization header must start with "Bearer "')
    .transform(val => val.slice(7)),

  /**
   * Pagination parameters
   */
  pagination: () => z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
    sort: z.string().regex(/^[a-zA-Z_]+:(asc|desc)$/, 'Invalid sort format').optional(),
  }),

  /**
   * Date range filter
   */
  dateRange: () => z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }).refine(
    (val) => !val.from || !val.to || val.from <= val.to,
    'Start date must be before end date'
  ),
};

/**
 * Middleware helper to validate and handle requests
 */
export async function validateRequest<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): Promise<ValidationResult<z.infer<T>>> {
  return RequestValidator.validateBody(request, schema);
}

/**
 * Audit logging for validation events
 */
class ValidationAuditLog {
  private static events: Array<{
    timestamp: Date;
    endpoint: string;
    isValid: boolean;
    fieldCount?: number;
    errorCount?: number;
  }> = [];

  static log(endpoint: string, isValid: boolean, errorCount?: number) {
    this.events.push({
      timestamp: new Date(),
      endpoint,
      isValid,
      errorCount,
    });

    // Keep recent events only
    if (this.events.length > 5000) {
      this.events = this.events.slice(-5000);
    }
  }

  static getStats() {
    const validCount = this.events.filter(e => e.isValid).length;
    const invalidCount = this.events.filter(e => !e.isValid).length;
    const totalValidationErrors = this.events
      .filter(e => !e.isValid)
      .reduce((sum, e) => sum + (e.errorCount ?? 0), 0);

    return {
      totalValidations: this.events.length,
      validRequests: validCount,
      invalidRequests: invalidCount,
      validationErrorRate: invalidCount > 0 ? (invalidCount / this.events.length * 100).toFixed(2) : '0',
      totalValidationErrors,
    };
  }
}

export { ValidationAuditLog };

