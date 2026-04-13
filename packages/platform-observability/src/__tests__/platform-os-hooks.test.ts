import { describe, it, expect, beforeEach } from 'vitest'
import {
  entityGraphOps,
  eventFabricPublished,
  decisionGraphCreated,
  aiRunExecutions,
  reasoningChainExecutions,
  dataFabricSyncJobs,
  searchLatency,
  aiRunLatency,
  reasoningChainLatency,
  ontologyLogger,
  entityGraphLogger,
  eventFabricLogger,
  knowledgeRegistryLogger,
  dataFabricLogger,
  decisionGraphLogger,
  contextOrchestratorLogger,
  semanticSearchLogger,
  governedAILogger,
  reasoningEngineLogger,
  tracePlatformOp,
} from '../platform-os-hooks'

describe('platform-os-hooks', () => {
  beforeEach(() => {
    entityGraphOps.reset()
    eventFabricPublished.reset()
    decisionGraphCreated.reset()
    aiRunExecutions.reset()
    reasoningChainExecutions.reset()
    dataFabricSyncJobs.reset()
    searchLatency.reset()
    aiRunLatency.reset()
    reasoningChainLatency.reset()
  })

  it('exposes named counters and histograms', () => {
    entityGraphOps.inc()
    eventFabricPublished.inc(2)
    decisionGraphCreated.inc()
    aiRunExecutions.inc()
    reasoningChainExecutions.inc()
    dataFabricSyncJobs.inc()

    searchLatency.observe(12)
    aiRunLatency.observe(40)
    reasoningChainLatency.observe(70)

    expect(entityGraphOps.get()).toBe(1)
    expect(eventFabricPublished.get()).toBe(2)
    expect(decisionGraphCreated.get()).toBe(1)
    expect(aiRunExecutions.get()).toBe(1)
    expect(reasoningChainExecutions.get()).toBe(1)
    expect(dataFabricSyncJobs.get()).toBe(1)

    expect(searchLatency.count()).toBe(1)
    expect(aiRunLatency.count()).toBe(1)
    expect(reasoningChainLatency.count()).toBe(1)
  })

  it('provides logger instances with expected methods', () => {
    const loggers = [
      ontologyLogger,
      entityGraphLogger,
      eventFabricLogger,
      knowledgeRegistryLogger,
      dataFabricLogger,
      decisionGraphLogger,
      contextOrchestratorLogger,
      semanticSearchLogger,
      governedAILogger,
      reasoningEngineLogger,
    ]

    for (const logger of loggers) {
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
    }
  })

  it('tracePlatformOp returns traced operation result', async () => {
    const result = await tracePlatformOp('calculate', 'platform-hooks', null, async () => 42)
    expect(result).toBe(42)
  })

  it('tracePlatformOp rethrows errors from the traced operation', async () => {
    await expect(
      tracePlatformOp('explode', 'platform-hooks', null, async () => {
        throw new Error('operation failed')
      }),
    ).rejects.toThrow('operation failed')
  })
})
