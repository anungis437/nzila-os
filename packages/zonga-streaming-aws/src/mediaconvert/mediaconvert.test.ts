/**
 * Tests — MediaConvert Module
 *
 * Validates job submission payload construction,
 * status reconciliation mapping, and cancel flow.
 * AWS SDK calls are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn()

vi.mock('@aws-sdk/client-mediaconvert', () => ({
  MediaConvertClient: class {
    send = mockSend
  },
  CreateJobCommand: vi.fn(),
  GetJobCommand: vi.fn(),
  CancelJobCommand: vi.fn(),
}))

describe('mediaconvert', () => {
  const config = {
    region: 'us-east-1',
    endpoint: 'https://abc.mediaconvert.us-east-1.amazonaws.com',
    roleArn: 'arn:aws:iam::123:role/MediaConvertRole',
    outputBucket: 'my-output-bucket',
    outputPrefix: 'transcoded/',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('submitTranscodeJob', () => {
    it('should submit job and return provider job id', async () => {
      mockSend.mockResolvedValueOnce({
        Job: {
          Id: 'mc-job-123',
          Arn: 'arn:aws:mediaconvert:us-east-1:123:jobs/mc-job-123',
          Status: 'SUBMITTED',
        },
      })

      const { submitTranscodeJob } = await import('.')
      const result = await submitTranscodeJob(config, {
        assetId: 'asset-1',
        orgId: 'org-1',
        inputStorageKey: 'raw/org-1/audio-abc.flac',
        inputBucket: 'my-raw-bucket',
        jobType: 'transcode_audio',
        qualities: [
          {
            label: 'standard',
            bitrate: 128,
            codec: 'aac',
            container: 'mp4',
            sampleRate: 44100,
          },
          {
            label: 'high',
            bitrate: 320,
            codec: 'aac',
            container: 'mp4',
            sampleRate: 48000,
          },
        ],
      })

      expect(result.providerJobId).toBe('mc-job-123')
      expect(result.status).toBe('submitted')
    })
  })

  describe('getTranscodeJobStatus', () => {
    it('should map COMPLETE → completed', async () => {
      mockSend.mockResolvedValueOnce({
        Job: {
          Id: 'mc-job-123',
          Status: 'COMPLETE',
          OutputGroupDetails: [
            {
              OutputDetails: [
                { OutputFilePaths: ['s3://out/transcoded/org-1/asset-1/standard/master.m3u8'] },
              ],
            },
          ],
        },
      })

      const { getTranscodeJobStatus } = await import('.')
      const result = await getTranscodeJobStatus(config, 'mc-job-123')

      expect(result.status).toBe('completed')
      expect(result.outputKeys).toContain('s3://out/transcoded/org-1/asset-1/standard/master.m3u8')
    })

    it('should map ERROR → failed with error message', async () => {
      mockSend.mockResolvedValueOnce({
        Job: {
          Id: 'mc-job-123',
          Status: 'ERROR',
          ErrorMessage: 'Input file not found',
          ErrorCode: 1404,
        },
      })

      const { getTranscodeJobStatus } = await import('.')
      const result = await getTranscodeJobStatus(config, 'mc-job-123')

      expect(result.status).toBe('failed')
      expect(result.errorMessage).toBe('Input file not found')
    })

    it('should map PROGRESSING → processing', async () => {
      mockSend.mockResolvedValueOnce({
        Job: {
          Id: 'mc-job-123',
          Status: 'PROGRESSING',
          JobPercentComplete: 65,
        },
      })

      const { getTranscodeJobStatus } = await import('.')
      const result = await getTranscodeJobStatus(config, 'mc-job-123')

      expect(result.status).toBe('processing')
      expect(result.progress).toBe(65)
    })
  })

  describe('cancelTranscodeJob', () => {
    it('should send cancel command', async () => {
      mockSend.mockResolvedValueOnce({})

      const { cancelTranscodeJob } = await import('.')
      await cancelTranscodeJob(config, 'mc-job-123')

      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })
})
