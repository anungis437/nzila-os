import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  app: {
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    listen: vi.fn((_port: unknown, callback?: () => void) => {
      callback?.()
      return { close: vi.fn() }
    }),
  },
  cors: vi.fn(() => 'cors-middleware'),
  helmet: vi.fn(() => 'helmet-middleware'),
  rateLimit: vi.fn(() => 'rate-limit-middleware'),
  dotenvConfig: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  startAnalyticsJobs: vi.fn(),
  stopAnalyticsJobs: vi.fn(),
  startDuesCalculationWorkflow: vi.fn(),
  stopDuesCalculationWorkflow: vi.fn(),
  startArrearsManagementWorkflow: vi.fn(),
  stopArrearsManagementWorkflow: vi.fn(),
  startPaymentCollectionWorkflow: vi.fn(),
  stopPaymentCollectionWorkflow: vi.fn(),
  startStipendProcessingWorkflow: vi.fn(),
  stopStipendProcessingWorkflow: vi.fn(),
}))

vi.mock('express', () => ({
  default: () => state.app,
  Router: vi.fn(() => ({ use: vi.fn(), get: vi.fn(), post: vi.fn() })),
}))
vi.mock('cors', () => ({ default: state.cors }))
vi.mock('helmet', () => ({ default: state.helmet }))
vi.mock('express-rate-limit', () => ({ default: state.rateLimit }))
vi.mock('dotenv', () => ({ default: { config: state.dotenvConfig }, config: state.dotenvConfig }))
vi.mock('@/lib/logger', () => ({ logger: state.logger }))
vi.mock('../../jobs/analytics-processor', () => ({
  startAnalyticsJobs: state.startAnalyticsJobs,
  stopAnalyticsJobs: state.stopAnalyticsJobs,
  getJobsStatus: vi.fn(),
}))
vi.mock('../../jobs/dues-calculation-workflow', () => ({
  startDuesCalculationWorkflow: state.startDuesCalculationWorkflow,
  stopDuesCalculationWorkflow: state.stopDuesCalculationWorkflow,
}))
vi.mock('../../jobs/arrears-management-workflow', () => ({
  startArrearsManagementWorkflow: state.startArrearsManagementWorkflow,
  stopArrearsManagementWorkflow: state.stopArrearsManagementWorkflow,
}))
vi.mock('../../jobs/payment-collection-workflow', () => ({
  startPaymentCollectionWorkflow: state.startPaymentCollectionWorkflow,
  stopPaymentCollectionWorkflow: state.stopPaymentCollectionWorkflow,
}))
vi.mock('../../jobs/stipend-processing-workflow', () => ({
  startStipendProcessingWorkflow: state.startStipendProcessingWorkflow,
  stopStipendProcessingWorkflow: state.stopStipendProcessingWorkflow,
}))
vi.mock('../../middleware/idempotency', () => ({ requireIdempotencyKey: 'idempotency-middleware' }))
vi.mock('../../middleware/authentication', () => ({
  authenticate: 'authenticate-middleware',
  requireFinancialSystemAdministrator: 'financial-admin-middleware',
}))
vi.mock('../../middleware/request-body', () => ({ parseFinancialRequestBody: 'request-body-middleware' }))
vi.mock('../../services/reconciliation-engine', () => ({ runReconciliation: vi.fn() }))
vi.mock('../../routes/dues-rules', () => ({ default: { module: 'dues-rules' } }))
vi.mock('../../routes/dues-assignments', () => ({ default: { module: 'dues-assignments' } }))
vi.mock('../../routes/dues-transactions', () => ({ default: { module: 'dues-transactions' } }))
vi.mock('../../routes/remittances', () => ({ default: { module: 'remittances' } }))
vi.mock('../../routes/arrears', () => ({ default: { module: 'arrears' } }))
vi.mock('../../routes/strike-funds', () => ({ default: { module: 'strike-funds' } }))
vi.mock('../../routes/donations', () => ({ default: { module: 'donations' } }))
vi.mock('../../routes/reports', () => ({ default: { module: 'reports' } }))
vi.mock('../../routes/picket-tracking', () => ({ default: { module: 'picket-tracking' } }))
vi.mock('../../routes/stipends', () => ({ default: { module: 'stipends' } }))
vi.mock('../../routes/payments', () => ({ default: { module: 'payments' } }))
vi.mock('../../routes/notifications', () => ({ default: { module: 'notifications' } }))
vi.mock('../../routes/analytics', () => ({ default: { module: 'analytics' } }))
vi.mock('../../routes/employer-timesheets', () => ({ default: { module: 'employer-timesheets' } }))
vi.mock('../../routes/employer-payroll-runs', () => ({
  default: { module: 'employer-payroll-runs' },
}))
vi.mock('../../routes/employer-remittance-runs', () => ({
  default: { module: 'employer-remittance-runs' },
}))
vi.mock('../../routes/employer-compliance', () => ({
  default: { module: 'employer-compliance' },
}))
vi.mock('../../routes/employer-replay', () => ({ default: { module: 'employer-replay' } }))

describe('financial service startup wiring', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.ENABLE_SCHEDULED_JOBS
  })

  it('starts owned jobs on listen and wires security middleware before routes', async () => {
    await import('../../index')

    expect(state.dotenvConfig).toHaveBeenCalledTimes(1)
    expect(state.helmet).toHaveBeenCalledTimes(1)
    expect(state.cors).toHaveBeenCalledTimes(1)
    expect(state.rateLimit).toHaveBeenCalledTimes(1)
    expect(state.app.listen).toHaveBeenCalledTimes(1)
    expect(state.startAnalyticsJobs).toHaveBeenCalledTimes(1)
    expect(state.startDuesCalculationWorkflow).toHaveBeenCalledTimes(1)
    expect(state.startArrearsManagementWorkflow).toHaveBeenCalledTimes(1)
    expect(state.startPaymentCollectionWorkflow).toHaveBeenCalledTimes(1)
    expect(state.startStipendProcessingWorkflow).toHaveBeenCalledTimes(1)
    expect(state.app.use).toHaveBeenCalledWith('/api/', 'idempotency-middleware')
    expect(state.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Financial service started'),
    )
  })
})
