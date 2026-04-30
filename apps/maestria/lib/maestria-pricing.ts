export interface PricingRequest {
  recipientCount: number
  tier: 'core' | 'premium' | 'signature'
  rushDelivery?: boolean
  bilingualBranding?: boolean
  customPackagingLevel?: 'none' | 'standard' | 'luxury'
}

const tierBase: Record<PricingRequest['tier'], number> = {
  core: 95,
  premium: 165,
  signature: 245,
}

export function buildPricingQuote(input: PricingRequest) {
  const baseUnit = tierBase[input.tier]
  const rushMultiplier = input.rushDelivery ? 1.18 : 1
  const bilingualFee = input.bilingualBranding ? 450 : 0

  const packagingMultiplier = input.customPackagingLevel === 'luxury'
    ? 1.12
    : input.customPackagingLevel === 'standard'
      ? 1.05
      : 1

  const subtotal = input.recipientCount * baseUnit * rushMultiplier * packagingMultiplier
  const serviceFee = subtotal * 0.045
  const total = subtotal + serviceFee + bilingualFee
  const depositRequired = total * 0.4
  const targetGrossMarginPercent = input.tier === 'signature' ? 48 : input.tier === 'premium' ? 44 : 39

  return {
    currency: 'CAD',
    inputs: input,
    subtotal: Number(subtotal.toFixed(2)),
    serviceFee: Number(serviceFee.toFixed(2)),
    bilingualFee: Number(bilingualFee.toFixed(2)),
    total: Number(total.toFixed(2)),
    depositRequired: Number(depositRequired.toFixed(2)),
    targetGrossMarginPercent,
    generatedAt: new Date().toISOString(),
  }
}
