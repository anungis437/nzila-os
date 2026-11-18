import { z } from 'zod'
import {
  CreateTaxInstallmentInput,
  CreateIndirectTaxPeriodInput,
  InstallmentStatus,
  IndirectTaxPeriodStatus,
} from '@nzila/tax/types'
// Preserve existing mutable schema/model fields while rejecting resource/owner substitution.
export const TaxInstallmentPatchSchema = CreateTaxInstallmentInput.omit({
  orgId: true,
  taxYearId: true,
})
  .partial()
  .extend({
    id: z.guid(),
    status: InstallmentStatus.optional(),
    paidAmount: CreateTaxInstallmentInput.shape.paidAmount.nullable().optional(),
    paymentDocumentId: CreateTaxInstallmentInput.shape.paymentDocumentId.nullable().optional(),
  })
  .strict()
export type TaxInstallmentPatch = z.infer<typeof TaxInstallmentPatchSchema>
export const IndirectTaxPeriodPatchSchema = CreateIndirectTaxPeriodInput.omit({
  orgId: true,
  accountId: true,
  taxType: true,
})
  .partial()
  .extend({
    id: z.guid(),
    status: IndirectTaxPeriodStatus.optional(),
    documentId: z.guid().nullable().optional(),
    sha256: z.string().nullable().optional(),
  })
  .strict()
export type IndirectTaxPeriodPatch = z.infer<typeof IndirectTaxPeriodPatchSchema>
