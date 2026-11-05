import { z } from 'zod';

// Money is a plain decimal with at most two places: the contract stores what the officer states, so it is held to a form
// that can be added and compared rather than free text.
const money = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Expected an amount such as 1250 or 1250.00');
const cents = (value: string) => Math.round(Number(value) * 100);

const lineItemSchema = z.object({
  lineType: z.enum(['module_license', 'feature_access', 'usage_quota', 'seat_allocation', 'support_level', 'sla_commitment', 'custom']),
  featureKey: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive().max(1_000_000).optional(),
  unitPrice: money.optional(),
  totalPrice: money.optional(),
  usageLimit: z.number().int().nonnegative().optional(),
  usagePeriod: z.string().max(50).optional(),
  slaTarget: z.string().max(200).optional(),
  effectiveDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional(),
}).superRefine((line, ctx) => {
  if (line.expirationDate && line.expirationDate <= line.effectiveDate) {
    ctx.addIssue({ code: 'custom', path: ['expirationDate'], message: 'expirationDate must be after effectiveDate' });
  }
  if (line.unitPrice && line.totalPrice && cents(line.unitPrice) * (line.quantity ?? 1) !== cents(line.totalPrice)) {
    ctx.addIssue({ code: 'custom', path: ['totalPrice'], message: 'totalPrice must equal unitPrice times quantity' });
  }
});

export const createContractSchema = z.object({
  billingAccountId: z.guid(),
  subscriptionId: z.guid().optional(),
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  effectiveDate: z.coerce.date(),
  expirationDate: z.coerce.date(),
  autoRenew: z.boolean().optional(),
  renewalTermMonths: z.number().int().positive().max(120).optional(),
  terminationNoticeDays: z.number().int().nonnegative().max(730).optional(),
  totalContractValue: money.optional(),
  lineItems: z.array(lineItemSchema).max(100).optional(),
}).superRefine((contract, ctx) => {
  if (contract.expirationDate <= contract.effectiveDate) {
    ctx.addIssue({ code: 'custom', path: ['expirationDate'], message: 'expirationDate must be after effectiveDate' });
  }
  // A stated total that disagrees with the priced lines is refused rather than stored beside them.
  const priced = (contract.lineItems ?? []).map((line) => line.totalPrice ?? (line.unitPrice ? String((cents(line.unitPrice) * (line.quantity ?? 1)) / 100) : undefined));
  if (contract.totalContractValue && priced.length > 0 && priced.every((price) => price !== undefined)) {
    const sum = priced.reduce((acc, price) => acc + cents(price as string), 0);
    if (sum !== cents(contract.totalContractValue)) {
      ctx.addIssue({ code: 'custom', path: ['totalContractValue'], message: 'totalContractValue must equal the sum of the priced line items' });
    }
  }
});
