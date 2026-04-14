/**
 * Tests — IVS Live Module
 *
 * Validates channel creation, RTMP URL construction,
 * stream key rotation, and state mapping.
 * AWS SDK calls are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn()

vi.mock('@aws-sdk/client-ivs', () => ({
  IvsClient: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  CreateChannelCommand: vi.fn(),
  GetChannelCommand: vi.fn(),
  GetStreamCommand: vi.fn(),
  CreateStreamKeyCommand: vi.fn(),
  DeleteStreamKeyCommand: vi.fn(),
  StopStreamCommand: vi.fn(),
  DeleteChannelCommand: vi.fn(),
  ListStreamKeysCommand: vi.fn(),
}))

describe('ivs-live', () => {
  const config = {
    region: 'us-east-1',
    latencyMode: 'LOW' as const,
    channelType: 'STANDARD' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createLiveChannel', () => {
    it('should create channel and return structured result', async () => {
      mockSend
        .mockResolvedValueOnce({
          // CreateChannelCommand response
          channel: {
            arn: 'arn:aws:ivs:us-east-1:123:channel/abc',
            ingestEndpoint: 'abc.global-contribute.live-video.net',
            playbackUrl: 'https://abc.global.live-video.net/live/ps-abc.m3u8',
          },
          streamKey: {
            arn: 'arn:aws:ivs:us-east-1:123:stream-key/sk-1',
            value: 'sk-live-abc123',
          },
        })

      const { createLiveChannel } = await import('../src/ivs-live')
      const result = await createLiveChannel(config, {
        eventId: 'evt-1',
        creatorId: 'user-1',
        orgId: 'org-1',
        name: 'Test Event',
      })

      expect(result.channelArn).toBe('arn:aws:ivs:us-east-1:123:channel/abc')
      expect(result.ingestEndpoint).toBe('abc.global-contribute.live-video.net')
      expect(result.playbackUrl).toContain('live-video.net')
      expect(result.streamKeyValue).toBe('sk-live-abc123')
    })
  })

  describe('buildRtmpIngestUrl', () => {
    it('should produce RTMPS URL', async () => {
      const { buildRtmpIngestUrl } = await import('../src/ivs-live')
      const url = buildRtmpIngestUrl('abc.global-contribute.live-video.net', 'sk-live-abc123')
      expect(url).toBe('rtmps://abc.global-contribute.live-video.net:443/app/sk-live-abc123')
    })
  })

  describe('getLiveChannelInfo', () => {
    it('should merge channel + stream data', async () => {
      mockSend
        .mockResolvedValueOnce({
          // GetChannelCommand
          channel: {
            arn: 'arn:aws:ivs:us-east-1:123:channel/abc',
            ingestEndpoint: 'abc.global-contribute.live-video.net',
            playbackUrl: 'https://abc.m3u8',
          },
        })
        .mockResolvedValueOnce({
          // GetStreamCommand
          stream: {
            state: 'LIVE',
            health: 'HEALTHY',
            viewerCount: 42,
          },
        })

      const { getLiveChannelInfo } = await import('../src/ivs-live')
      const info = await getLiveChannelInfo(config, 'arn:aws:ivs:us-east-1:123:channel/abc')

      expect(info.state).toBe('live')
      expect(info.health).toBe('HEALTHY')
      expect(info.viewerCount).toBe(42)
    })

    it('should handle no active stream gracefully', async () => {
      mockSend
        .mockResolvedValueOnce({
          channel: {
            arn: 'arn:aws:ivs:us-east-1:123:channel/abc',
            ingestEndpoint: 'abc.endpoint',
            playbackUrl: 'https://abc.m3u8',
          },
        })
        .mockRejectedValueOnce({ name: 'ChannelNotBroadcasting' })

      const { getLiveChannelInfo } = await import('../src/ivs-live')
      const info = await getLiveChannelInfo(config, 'arn:aws:ivs:us-east-1:123:channel/abc')

      expect(info.state).toBe('ready')
      expect(info.viewerCount).toBe(0)
    })
  })
})
