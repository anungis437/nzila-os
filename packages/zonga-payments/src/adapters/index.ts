/**
 * @nzila/zonga-payments — Adapters Barrel Export
 *
 * @module @nzila/zonga-payments/adapters
 */

export { createStripeAdapter, type StripeConfig } from './stripe.adapter'
export { createMoMoAdapter, type MoMoConfig } from './momo.adapter'
export { createOrangeMoneyAdapter, type OrangeMoneyConfig } from './orange.adapter'
export { createAirtelAdapter, type AirtelConfig } from './airtel.adapter'
export { createVodacomMpesaAdapter } from './vodacom-mpesa.adapter'
export { type VodacomMpesaConfig, VodacomMpesaError, MpesaResponseCode } from './vodacom-mpesa.types'
