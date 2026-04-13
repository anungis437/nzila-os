import { describe, it, expect } from 'vitest'
import {
  LOW_DATA_CONFIG,
  NetworkType,
  toLightMetadata,
  toLightMetadataBatch,
  shouldSuggestLowData,
  selectQualityForBandwidth,
} from './low-data'

describe('toLightMetadata', () => {
  it('maps heavy metadata to light metadata and rewrites artwork url', () => {
    const result = toLightMetadata(
      {
        id: 'track-1',
        title: 'Song',
        artistName: 'Artist',
        albumTitle: 'Album',
        durationMs: 120000,
        genre: 'Afrobeat',
        coverArtUrl: 'https://cdn/full.png',
        waveformData: [1, 2, 3],
        lyrics: 'lyrics',
        credits: ['c1'],
      },
      'https://art.example.com',
    )

    expect(result).toEqual({
      id: 'track-1',
      title: 'Song',
      artistName: 'Artist',
      durationMs: 120000,
      genre: 'Afrobeat',
      coverArtUrl: `https://art.example.com/track-1/${LOW_DATA_CONFIG.MAX_ARTWORK_SIZE}x${LOW_DATA_CONFIG.MAX_ARTWORK_SIZE}.webp`,
    })
  })

  it('returns null cover art when source has no cover', () => {
    const result = toLightMetadata(
      {
        id: 'track-2',
        title: 'Song 2',
        artistName: 'Artist 2',
        albumTitle: null,
        durationMs: 30000,
        genre: 'Jazz',
        coverArtUrl: null,
        waveformData: null,
        lyrics: null,
        credits: [],
      },
      'https://art.example.com',
    )

    expect(result.coverArtUrl).toBeNull()
  })
})

describe('toLightMetadataBatch', () => {
  it('limits output to configured prefetch limit', () => {
    const tracks = Array.from({ length: LOW_DATA_CONFIG.METADATA_PREFETCH_LIMIT + 2 }, (_, i) => ({
      id: `track-${i}`,
      title: `Title ${i}`,
      artistName: 'Artist',
      albumTitle: null,
      durationMs: 1000,
      genre: 'Amapiano',
      coverArtUrl: null,
      waveformData: null,
      lyrics: null,
      credits: [],
    }))

    const result = toLightMetadataBatch(tracks, 'https://art.example.com')
    expect(result).toHaveLength(LOW_DATA_CONFIG.METADATA_PREFETCH_LIMIT)
    expect(result[0]?.id).toBe('track-0')
  })
})

describe('shouldSuggestLowData', () => {
  it('respects explicit user preference override', () => {
    expect(
      shouldSuggestLowData({
        networkType: NetworkType.WIFI,
        estimatedBandwidthKbps: 5000,
        userPreference: true,
      }),
    ).toBe(true)

    expect(
      shouldSuggestLowData({
        networkType: NetworkType.CELLULAR_2G,
        estimatedBandwidthKbps: 50,
        userPreference: false,
      }),
    ).toBe(false)
  })

  it('auto-suggests for 2g and 3g networks', () => {
    expect(
      shouldSuggestLowData({
        networkType: NetworkType.CELLULAR_2G,
        estimatedBandwidthKbps: null,
        userPreference: null,
      }),
    ).toBe(true)

    expect(
      shouldSuggestLowData({
        networkType: NetworkType.CELLULAR_3G,
        estimatedBandwidthKbps: null,
        userPreference: null,
      }),
    ).toBe(true)
  })

  it('auto-suggests for very low bandwidth and not otherwise', () => {
    expect(
      shouldSuggestLowData({
        networkType: NetworkType.UNKNOWN,
        estimatedBandwidthKbps: 149,
        userPreference: null,
      }),
    ).toBe(true)

    expect(
      shouldSuggestLowData({
        networkType: NetworkType.UNKNOWN,
        estimatedBandwidthKbps: 150,
        userPreference: null,
      }),
    ).toBe(false)
  })
})

describe('selectQualityForBandwidth', () => {
  it('forces low quality when low data mode is enabled', () => {
    expect(selectQualityForBandwidth(1000, true)).toBe('low')
  })

  it('uses medium when bandwidth is unknown and low-data mode is off', () => {
    expect(selectQualityForBandwidth(null, false)).toBe('medium')
  })

  it('maps thresholds to low, medium, and high', () => {
    expect(selectQualityForBandwidth(99, false)).toBe('low')
    expect(selectQualityForBandwidth(100, false)).toBe('medium')
    expect(selectQualityForBandwidth(399, false)).toBe('medium')
    expect(selectQualityForBandwidth(400, false)).toBe('high')
  })
})
