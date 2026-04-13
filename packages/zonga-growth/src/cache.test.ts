import { describe, it, expect } from 'vitest'
import { CacheKeys, CacheTTL, InvalidationPatterns } from './cache'

describe('CacheKeys', () => {
  it('recommendation builds correct key', () => {
    expect(CacheKeys.recommendation('org1', 'u1', 'trending'))
      .toBe('zonga:reco:org1:u1:trending')
  })

  it('trending builds correct key', () => {
    expect(CacheKeys.trending('org1')).toBe('zonga:trending:org1')
  })

  it('trackMetadata builds correct key', () => {
    expect(CacheKeys.trackMetadata('org1', 'asset1'))
      .toBe('zonga:track:org1:asset1')
  })

  it('playlistMetadata builds correct key', () => {
    expect(CacheKeys.playlistMetadata('org1', 'pl1'))
      .toBe('zonga:playlist:org1:pl1')
  })

  it('creatorProfile builds correct key', () => {
    expect(CacheKeys.creatorProfile('org1', 'c1'))
      .toBe('zonga:creator:org1:c1')
  })

  it('followerCount builds correct key', () => {
    expect(CacheKeys.followerCount('org1', 'u1'))
      .toBe('zonga:followers:org1:u1')
  })

  it('streamSession builds correct key', () => {
    expect(CacheKeys.streamSession('sess1'))
      .toBe('zonga:session:sess1')
  })

  it('friendsListening builds correct key', () => {
    expect(CacheKeys.friendsListening('org1', 'u1'))
      .toBe('zonga:friends:org1:u1')
  })
})

describe('CacheTTL', () => {
  it('has expected TTL values', () => {
    expect(CacheTTL.TRACK_METADATA).toBe(3600)
    expect(CacheTTL.TRENDING).toBe(300)
    expect(CacheTTL.RECOMMENDATION_FOR_YOU).toBe(1800)
    expect(CacheTTL.STREAM_SESSION).toBe(86400)
    expect(CacheTTL.FRIENDS_LISTENING).toBe(30)
  })
})

describe('InvalidationPatterns', () => {
  it('userRecommendations returns wildcard pattern', () => {
    expect(InvalidationPatterns.userRecommendations('org1', 'u1'))
      .toBe('zonga:reco:org1:u1:*')
  })

  it('track returns exact key', () => {
    expect(InvalidationPatterns.track('org1', 'a1'))
      .toBe('zonga:track:org1:a1')
  })

  it('trending returns org key', () => {
    expect(InvalidationPatterns.trending('org1'))
      .toBe('zonga:trending:org1')
  })
})
