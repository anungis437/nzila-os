/**
 * AutoPay Settings Schema
 * Stores automatic payment configuration for union dues
 * 
 * Part of Week 2 P1 Implementation
 */

import { pgTable, varchar, decimal, timestamp, boolean, text, uuid } from 'drizzle-orm/pg-core';

/**
 * AutoPay Settings Table
 * Manages automatic payment configurations for members
 */
export const autoPaySettings = pgTable('autopay_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Member identification
  userId: varchar('user_id', { length: 255 }).notNull(), // Auth user ID
  
  // Payment configuration
  enabled: boolean('enabled').notNull().default(false),
  
  // Stripe payment method (from Stripe Customer)
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripePaymentMethodId: varchar('stripe_payment_method_id', { length: 255 }),
  paymentMethodLast4: varchar('payment_method_last4', { length: 4 }),
  paymentMethodBrand: varchar('payment_method_brand', { length: 50 }), // visa, mastercard, amex, etc.
  paymentMethodType: varchar('payment_method_type', { length: 50 }).default('card'), // card, bank_account, etc.
  
  // Autopay preferences
  maxAmount: decimal('max_amount', { precision: 10, scale: 2 }), // Optional maximum amount per transaction
  frequency: varchar('frequency', { length: 50 }).default('monthly'), // monthly, quarterly, annually
  dayOfMonth: varchar('day_of_month', { length: 2 }).default('1'), // 1-28 for monthly payments
  
  // Status tracking
  lastPaymentDate: timestamp('last_payment_date', { mode: 'date' }),
  lastPaymentAmount: decimal('last_payment_amount', { precision: 10, scale: 2 }),
  lastPaymentStatus: varchar('last_payment_status', { length: 50 }), // success, failed, pending
  
  nextPaymentDate: timestamp('next_payment_date', { mode: 'date' }),
  
  failureCount: varchar('failure_count', { length: 255 }).default('0'), // Track consecutive failures
  lastFailureReason: text('last_failure_reason'),
  
  // Notifications
  notifyBeforePayment: boolean('notify_before_payment').default(true),
  notifyDaysBefore: varchar('notify_days_before', { length: 255 }).default('3'),
  
  // Audit
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 255 }),
  updatedBy: varchar('updated_by', { length: 255 }),
});

export type AutoPaySettings = typeof autoPaySettings.$inferSelect;
export type NewAutoPaySettings = typeof autoPaySettings.$inferInsert;
