import { z } from 'zod';

// ── Expense Request ──────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  'office_supplies',
  'travel',
  'meals',
  'professional_services',
  'utilities',
  'rent',
  'marketing',
  'training',
  'other',
] as const;

const PAYMENT_METHODS = [
  'personal_card',
  'corporate_card',
  'cash',
  'check',
] as const;

export const expenseRequestSchema = z.object({
  expenseDate: z.string().min(1, 'Expense date is required'),
  accountCode: z
    .string()
    .min(1, 'Account code is required')
    .regex(/^\d{4}-\d{2,3}$/, 'Account code must match format XXXX-XX (e.g. 5000-100)'),
  budgetId: z.string().optional(),
  vendorName: z.string().optional(),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(1000, 'Description must be under 1000 characters'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Amount must be a positive number'),
  taxAmount: z
    .string()
    .refine((v) => v === '' || (!isNaN(Number(v)) && Number(v) >= 0), 'Tax amount must be non-negative'),
  category: z.enum(EXPENSE_CATEGORIES).or(z.literal('')).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  reimbursementRequired: z.boolean(),
  receiptUrl: z
    .string()
    .url('Must be a valid URL')
    .or(z.literal(''))
    .optional(),
  notes: z.string().max(2000, 'Notes must be under 2000 characters').optional(),
});

export type ExpenseRequestInput = z.infer<typeof expenseRequestSchema>;

// ── Vendor ───────────────────────────────────────────────────────────────────

const VENDOR_TYPES = [
  'supplier',
  'contractor',
  'professional_services',
  'utilities',
  'landlord',
  'other',
] as const;

const VENDOR_STATUSES = ['active', 'inactive', 'suspended'] as const;

const PAYMENT_TERMS = [
  'net_15',
  'net_30',
  'net_45',
  'net_60',
  'net_90',
  'due_on_receipt',
  'cod',
] as const;

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'] as const;

export const vendorSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required').max(200),
  legalName: z.string().max(200).optional(),
  vendorType: z.enum(VENDOR_TYPES).or(z.literal('')).optional(),
  taxId: z.string().max(20).optional(),
  website: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  email: z.string().email('Must be a valid email address').or(z.literal('')).optional(),
  phone: z.string().max(30).optional(),
  fax: z.string().max(30).optional(),
  primaryContactName: z.string().max(150).optional(),
  primaryContactEmail: z
    .string()
    .email('Must be a valid email address')
    .or(z.literal(''))
    .optional(),
  primaryContactPhone: z.string().max(30).optional(),
  paymentTerms: z.enum(PAYMENT_TERMS),
  defaultAccountCode: z.string().max(20).optional(),
  currency: z.enum(CURRENCIES),
  creditLimit: z
    .string()
    .refine((v) => v === '' || (!isNaN(Number(v)) && Number(v) >= 0), 'Credit limit must be non-negative')
    .optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(VENDOR_STATUSES),
});

export type VendorInput = z.infer<typeof vendorSchema>;

// ── Budget ───────────────────────────────────────────────────────────────────

const PERIOD_TYPES = ['annual', 'quarterly', 'monthly', 'project'] as const;

export const budgetSchema = z
  .object({
    budgetName: z.string().min(1, 'Budget name is required').max(200),
    fiscalYear: z
      .number()
      .int()
      .min(2000, 'Fiscal year must be 2000 or later')
      .max(2100, 'Fiscal year must be 2100 or earlier'),
    periodType: z.enum(PERIOD_TYPES),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    totalBudget: z
      .string()
      .min(1, 'Total budget is required')
      .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Budget must be a positive number'),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    { message: 'End date must be after start date', path: ['endDate'] },
  );

export type BudgetInput = z.infer<typeof budgetSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format Zod errors into a record keyed by field path.
 */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}
