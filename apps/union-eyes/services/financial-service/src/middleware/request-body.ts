import express, { type RequestHandler } from 'express'

const stripeWebhooks = new Set(['/api/donations/webhooks/stripe', '/api/payments/webhook/stripe'])
const json = express.json({ limit: '10mb' })
const urlencoded = express.urlencoded({ extended: true })

export const parseFinancialRequestBody: RequestHandler = (req, res, next) => {
  if (stripeWebhooks.has(req.path)) {
    next()
    return
  }
  json(req, res, (error?: unknown) => {
    if (error) {
      next(error)
      return
    }
    urlencoded(req, res, next)
  })
}
