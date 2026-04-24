export const WEEKONE_ANALYTICS_EVENTS = {
  LANDING_CTA_CLICK: 'weekone.landing.cta_click',
  PRICING_VIEW: 'weekone.pricing.view',
  CHECKOUT_START: 'weekone.checkout.start',
  SIGNUP_COMPLETE: 'weekone.signup.complete',
  REFERRAL_SHARE: 'weekone.referral.share',
  BLOG_CONVERSION: 'weekone.blog.conversion',
  NEWSLETTER_SUBMIT: 'weekone.newsletter.submit',
  WAITLIST_SUBMIT: 'weekone.waitlist.submit',
  TEMPLATE_DOWNLOAD: 'weekone.template.download',
  EXIT_INTENT_CTA: 'weekone.exit_intent.cta',
} as const

export type WeekoneAnalyticsEventName =
  (typeof WEEKONE_ANALYTICS_EVENTS)[keyof typeof WEEKONE_ANALYTICS_EVENTS]

export const WEEKONE_ANALYTICS_EVENT_SET = new Set<string>(Object.values(WEEKONE_ANALYTICS_EVENTS))
