import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG, type CircuitBreakerPorts } from './circuitBreaker'
import type { ProviderHealthRecord, CircuitState } from '@nzila/integrations-db'

function makeHealthRecord(overrides?: Partial<ProviderHealthRecord>): ProviderHealthRecord {
  return {
    id: 'h-1',
    orgId: 'org-1',
    provider: 'resend',
    status: 'ok',
    consecutiveFailures: 0,
    circuitState: 'closed',
    lastCheckedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    circuitOpenedAt: null,
    circuitNextRetryAt: null,
    createdAt: '2026-02-27T12:00:00.000Z',
    updatedAt: '2026-02-27T12:00:00.000Z',
    ...overrides,
  }
}

function makePorts(overrides?: Partial<CircuitBreakerPorts>): CircuitBreakerPorts {
  return {
    healthRepo: {
      upsert: vi.fn().mockResolvedValue(makeHealthRecord()),
      findByOrgAndProvider: vi.fn().mockResolvedValue(null),
      listByOrg: vi.fn().mockResolvedValue([]),
      listAll: vi.fn().mockResolvedValue([]),
      updateCircuitState: vi.fn().mockResolvedValue(makeHealthRecord()),
    },
    emitAudit: vi.fn(),
    now: () => new Date('2026-02-27T12:00:00.000Z'),
    ...overrides,
  }
}

describe('CircuitBreaker', () => {
  let ports: CircuitBreakerPorts
  let cb: CircuitBreaker

  beforeEach(() => {
    ports = makePorts()
    cb = new CircuitBreaker(ports)
  })

  describe('canExecute', () => {
    it('allows when no health record exists (implicit closed)', async () => {
      const result = await cb.canExecute('org-1', 'resend')
      expect(result.allowed).toBe(true)
      expect(result.state).toBe('closed')
    })

    it('allows when circuit is closed', async () => {
      ports = makePorts({
        healthRepo: {
          ...makePorts().healthRepo,
          findByOrgAndProvider: vi.fn().mockResolvedValue(makeHealthRecord({ circuitState: 'closed' })),
        },
      })
      cb = new CircuitBreaker(ports)

      const result = await cb.canExecute('org-1', 'resend')
      expect(result.allowed).toBe(true)
      expect(result.state).toBe('closed')
    })

    it('blocks when circuit is OPEN and cooldown has not expired', async () => {
      const futureRetry = new Date('2026-02-27T13:00:00.000Z').toISOString()
      ports = makePorts({
        healthRepo: {
          ...makePorts().healthRepo,
          findByOrgAndProvider: vi.fn().mockResolvedValue(
            makeHealthRecord({ circuitState: 'open', circuitNextRetryAt: futureRetry }),
          ),
        },
      })
      cb = new CircuitBreaker(ports)

      const result = await cb.canExecute('org-1', 'resend')
      expect(result.allowed).toBe(false)
      expect(result.state).toBe('open')
      expect(result.reason).toContain('Circuit OPEN')
    })

    it('transitions OPEN → HALF_OPEN when cooldown expires', async () => {
      const pastRetry = new Date('2026-02-27T11:00:00.000Z').toISOString()
      ports = makePorts({
        healthRepo: {
          ...makePorts().healthRepo,
          findByOrgAndProvider: vi.fn().mockResolvedValue(
            makeHealthRecord({ circuitState: 'open', circuitNextRetryAt: pastRetry }),
          ),
          updateCircuitState: vi.fn().mockResolvedValue(makeHealthRecord({ circuitState: 'half_open' })),
        },
      })
      cb = new CircuitBreaker(ports)

      const result = await cb.canExecute('org-1', 'resend')
      expect(result.allowed).toBe(true)
      expect(result.state).toBe('half_open')
      expect(ports.emitAudit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'integration.circuit.half_open' }),
      )
    })

    it('limits probes in HALF_OPEN state', async () => {
      ports = makePorts({
        healthRepo: {
          ...makePorts().healthRepo,
          findByOrgAndProvider: vi.fn().mockResolvedValue(
            makeHealthRecord({ circuitState: 'half_open' }),
          ),
        },
      })
      cb = new CircuitBreaker(ports, { halfOpenMaxProbes: 2 })

      // First two probes allowed
      expect((await cb.canExecute('org-1', 'resend')).allowed).toBe(true)
      expect((await cb.canExecute('org-1', 'resend')).allowed).toBe(true)
      // Third blocked
      expect((await cb.canExecute('org-1', 'resend')).allowed).toBe(false)
    })
  })

  describe('recordResult', () => {
    it('stays CLOSED on success', async () => {
      ports = makePorts({
        healthRepo: {
          ...makePorts().healthRepo,
          findByOrgAndProvider: vi.fn().mockResolvedValue(makeHealthRecord({ circuitState: 'closed' })),
        },
      })
      cb = new CircuitBreaker(ports)

      const result = await cb.recordResult('org-1', 'resend', true)
      expect(result.newState).toBe('closed')
      expect(result.transitioned).toBe(false)
    })

    it('trips CLOSED → OPEN on consecutive failure threshold', async () => {
      ports = makePorts({
        healthRepo: {
          ...makePorts().healthRepo,
          findByOrgAndProvider: vi.fn().mockResolvedValue(
            makeHealthRecord({ circuitState: 'closed', consecutiveFailures: 4 }),
          ),
        },
      })
      cb = new CircuitBreaker(ports)

      const result = await cb.recordResult('org-1', 'resend', false)
      expect(result.previousState).toBe('closed')
      expect(result.newState).toBe('open')
      expect(result.transitioned).toBe(true)
      expect(ports.emitAudit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'integration.circuit.opened' }),
      )
    })

    it('trips CLOSED → OPEN on failure rate threshold', async () => {
      ports = makePorts({
        healthRepo: {
          ...makePorts().healthRepo,
          findByOrgAndProvider: vi.fn().mockResolvedValue(
            makeHealthRecord({ circuitState: 'closed', consecutiveFailures: 1 }),
          ),
        },
      })
      cb = new CircuitBreaker(ports)

      const result = await cb.recordResult('org-1', 'resend', false, {
        totalInWindow: 20,
        failuresInWindow: 15,
      })
      expect(result.newState).toBe('open')
      expect(result.transitioned).toBe(true)
    })

    it('closes circuit on HALF_OPEN success', async () => {
      ports = makePorts({
        healthRepo: {
          ...makePorts().healthRepo,
          findByOrgAndProvider: vi.fn().mockResolvedValue(
            makeHealthRecord({ circuitState: 'half_open' }),
          ),
        },
      })
      cb = new CircuitBreaker(ports)

      const result = await cb.recordResult('org-1', 'resend', true)
      expect(result.previousState).toBe('half_open')
      expect(result.newState).toBe('closed')
      expect(result.transitioned).toBe(true)
      expect(ports.emitAudit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'integration.circuit.closed' }),
      )
    })

    it('reopens circuit on HALF_OPEN failure', async () => {
      ports = makePorts({
        healthRepo: {
          ...makePorts().healthRepo,
          findByOrgAndProvider: vi.fn().mockResolvedValue(
            makeHealthRecord({ circuitState: 'half_open' }),
          ),
        },
      })
      cb = new CircuitBreaker(ports)

      const result = await cb.recordResult('org-1', 'resend', false)
      expect(result.previousState).toBe('half_open')
      expect(result.newState).toBe('open')
      expect(result.transitioned).toBe(true)
    })
  })

  describe('forceOpen', () => {
    it('opens the circuit and emits audit', async () => {
      await cb.forceOpen('org-1', 'resend')
      expect(ports.healthRepo.updateCircuitState).toHaveBeenCalledWith(
        'org-1',
        'resend',
        'open',
        expect.any(String),
      )
      expect(ports.emitAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.circuit.opened',
          details: expect.objectContaining({ reason: 'manual_force_open' }),
        }),
      )
    })
  })

  describe('forceReset', () => {
    it('closes the circuit and emits audit', async () => {
      await cb.forceReset('org-1', 'resend')
      expect(ports.healthRepo.upsert).toHaveBeenCalledWith(
        'org-1',
        'resend',
        expect.objectContaining({ circuitState: 'closed', consecutiveFailures: 0 }),
      )
      expect(ports.emitAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.circuit.closed',
          details: expect.objectContaining({ reason: 'manual_reset' }),
        }),
      )
    })
  })
})
