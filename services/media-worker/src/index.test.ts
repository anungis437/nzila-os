import { describe, it, expect } from 'vitest'
import * as mediaWorker from './index'

describe('media-worker barrel', () => {
  it('exports key runtime APIs', () => {
    expect(mediaWorker.createInMemoryStorageAdapter).toBeTypeOf('function')
    expect(mediaWorker.createTranscodeService).toBeTypeOf('function')
    expect(mediaWorker.createStreamingDeliveryService).toBeTypeOf('function')
    expect(mediaWorker.toLightMetadata).toBeTypeOf('function')
    expect(mediaWorker.validateEnv).toBeTypeOf('function')
  })

  it('re-exports recovery and queue utilities', () => {
    expect(mediaWorker.classifyFailure).toBeTypeOf('function')
    expect(mediaWorker.cleanupPartialArtifacts).toBeTypeOf('function')
    expect(mediaWorker.createInMemoryQueueProvider).toBeTypeOf('function')
    expect(mediaWorker.MEDIA_METRICS).toBeDefined()
  })
})
