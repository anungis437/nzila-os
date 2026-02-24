/**
 * AutoPay Utilities
 * Helper functions for managing automatic payment settings
 * 
 * Part of Week 2 P1 Implementation
 */

import { db } from '@/db/db';
import { autoPaySettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
// eslint-disable-next-line no-restricted-imports -- TODO(platform-migration): migrate to @nzila/ wrapper
import { stripe } from '@/lib/stripe';
// eslint-disable-next-line no-restricted-imports -- TODO(platform-migration): migrate to @nzila/ wrapper
import type Stripe from 'stripe';

export interface AutoPaySettingsData {
  userId: string;
  enabled: boolean;
  stripeCustomerId?: string | null;
  stripePaymentMethodId?: string | null;
  paymentMethodLast4?: string | null;
  paymentMethodBrand?: string | null;
  paymentMethodType?: string | null;
  maxAmount?: string | null;
  frequency?: string;
  dayOfMonth?: string;
  notifyBeforePayment?: boolean;
  notifyDaysBefore?: string;
}

/**
 * Get autopay settings for a user
 */
export async function getAutoPaySettings(userId: string) {
  const settings = await db
    .select()
    .from(autoPaySettings)
    .where(eq(autoPaySettings.userId, userId))
    .limit(1);

  return settings[0] || null;
}

/**
 * Get Stripe customer information
 */
export async function getStripeCustomer(stripeCustomerId: string) {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    if (customer.deleted) {
      return null;
    }
    return customer as Stripe.Customer;
  } catch (_error) {
return null;
  }
}

/**
 * Get Stripe payment method information
 */
export async function getStripePaymentMethod(paymentMethodId: string) {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    return paymentMethod;
  } catch (_error) {
return null;
  }
}

/**
 * Extract last 4 digits from payment method
 */
export function getPaymentMethodLast4(paymentMethod: Stripe.PaymentMethod): string | null {
  if (paymentMethod.type === 'card' && paymentMethod.card) {
    return paymentMethod.card.last4;
  }
  if (paymentMethod.type === 'us_bank_account' && paymentMethod.us_bank_account) {
    return paymentMethod.us_bank_account.last4;
  }
  return null;
}

/**
 * Extract payment method brand
 */
export function getPaymentMethodBrand(paymentMethod: Stripe.PaymentMethod): string | null {
  if (paymentMethod.type === 'card' && paymentMethod.card) {
    return paymentMethod.card.brand;
  }
  if (paymentMethod.type === 'us_bank_account' && paymentMethod.us_bank_account) {
    return paymentMethod.us_bank_account.bank_name || 'bank_account';
  }
  return paymentMethod.type;
}

/**
 * Create or update autopay settings
 */
export async function upsertAutoPaySettings(data: AutoPaySettingsData) {
  const existing = await getAutoPaySettings(data.userId);

  const settingsData = {
    userId: data.userId,
    enabled: data.enabled,
    stripeCustomerId: data.stripeCustomerId || null,
    stripePaymentMethodId: data.stripePaymentMethodId || null,
    paymentMethodLast4: data.paymentMethodLast4 || null,
    paymentMethodBrand: data.paymentMethodBrand || null,
    paymentMethodType: data.paymentMethodType || 'card',
    maxAmount: data.maxAmount || null,
    frequency: data.frequency || 'monthly',
    dayOfMonth: data.dayOfMonth || '1',
    notifyBeforePayment: data.notifyBeforePayment ?? true,
    notifyDaysBefore: data.notifyDaysBefore || '3',
    updatedAt: new Date(),
    updatedBy: data.userId,
  };

  if (existing) {
    // Update existing settings
    const [updated] = await db
      .update(autoPaySettings)
      .set(settingsData)
      .where(eq(autoPaySettings.userId, data.userId))
      .returning();
    return updated;
  } else {
    // Create new settings
    const [created] = await db
      .insert(autoPaySettings)
      .values({
        ...settingsData,
        createdBy: data.userId,
      })
      .returning();
    return created;
  }
}

/**
 * Disable autopay for a user
 */
export async function disableAutoPay(userId: string) {
  const [updated] = await db
    .update(autoPaySettings)
    .set({
      enabled: false,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(eq(autoPaySettings.userId, userId))
    .returning();
  return updated;
}

/**
 * Get autopay settings with Stripe payment method details
 */
export async function getAutoPaySettingsWithPaymentMethod(userId: string) {
  const settings = await getAutoPaySettings(userId);
  if (!settings || !settings.stripePaymentMethodId) {
    return {
      settings,
      paymentMethod: null,
    };
  }

  const paymentMethod = await getStripePaymentMethod(settings.stripePaymentMethodId);
  
  return {
    settings,
    paymentMethod,
  };
}
