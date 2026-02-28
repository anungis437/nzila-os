export const AgriEventTypes = {
  // Harvest lifecycle
  HARVEST_RECORDED: 'agri.harvest.recorded',

  // Lot lifecycle
  LOT_CREATED: 'agri.lot.created',
  LOT_AGGREGATED: 'agri.lot.aggregated',
  LOT_INSPECTED: 'agri.lot.inspected',
  LOT_GRADED: 'agri.lot.graded',
  LOT_CERTIFIED: 'agri.lot.certified',
  LOT_REJECTED: 'agri.lot.rejected',

  // Quality
  QUALITY_INSPECTED: 'agri.quality.inspected',

  // Batch lifecycle
  BATCH_CREATED: 'agri.batch.created',
  BATCH_ALLOCATED: 'agri.batch.allocated',

  // Shipment lifecycle
  SHIPMENT_PLANNED: 'agri.shipment.planned',
  SHIPMENT_DISPATCHED: 'agri.shipment.dispatched',
  SHIPMENT_MILESTONE: 'agri.shipment.milestone',
  SHIPMENT_ARRIVED: 'agri.shipment.arrived',
  SHIPMENT_CLOSED: 'agri.shipment.closed',

  // Payment lifecycle
  PAYMENT_PLAN_CREATED: 'agri.payment.plan.created',
  PAYMENT_EXECUTED: 'agri.payment.executed',
  PAYMENT_DISBURSED: 'agri.payment.disbursed',

  // Certification
  CERTIFICATION_ISSUED: 'agri.certification.issued',
} as const

export type AgriEventType = (typeof AgriEventTypes)[keyof typeof AgriEventTypes]
