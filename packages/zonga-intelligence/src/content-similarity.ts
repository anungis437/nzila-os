/**
 * @nzila/zonga-intelligence — Content-Based Similarity
 *
 * Computes how similar two tracks are based on audio attributes:
 * genre, mood, BPM, key, energy, danceability, etc.
 *
 * Uses cosine similarity over normalized feature vectors.
 * Each attribute has its own normalization and weighting.
 */

import type { ContentSimilarity } from './recommendation-engine'

// ── Types ───────────────────────────────────────────────────────────────────

export interface TrackAttributes {
  readonly trackId: string
  readonly genres: readonly string[]
  readonly moods: readonly string[]
  readonly bpm: number
  readonly key: string               // e.g. "Cmaj", "Amin"
  readonly energy: number            // 0-1
  readonly danceability: number      // 0-1
  readonly acousticness: number      // 0-1
  readonly instrumentalness: number  // 0-1
  readonly valence: number           // 0-1 happiness
  readonly durationMs: number
  readonly language?: string
  readonly releaseYear?: number
}

export interface SimilarityWeights {
  genre: number
  mood: number
  bpm: number
  key: number
  energy: number
  danceability: number
  acousticness: number
  instrumentalness: number
  valence: number
  duration: number
  language: number
  era: number
}

export const DEFAULT_SIMILARITY_WEIGHTS: Readonly<SimilarityWeights> = {
  genre: 0.25,
  mood: 0.15,
  bpm: 0.10,
  key: 0.05,
  energy: 0.10,
  danceability: 0.08,
  acousticness: 0.05,
  instrumentalness: 0.04,
  valence: 0.08,
  duration: 0.02,
  language: 0.05,
  era: 0.03,
}

// ── Musical Key Relationships ───────────────────────────────────────────────

// Circle of fifths — adjacent keys are harmonically compatible
const KEY_ORDER = [
  'Cmaj', 'Gmaj', 'Dmaj', 'Amaj', 'Emaj', 'Bmaj',
  'F#maj', 'Dbmaj', 'Abmaj', 'Ebmaj', 'Bbmaj', 'Fmaj',
  'Amin', 'Emin', 'Bmin', 'F#min', 'C#min', 'G#min',
  'Ebmin', 'Bbmin', 'Fmin', 'Cmin', 'Gmin', 'Dmin',
] as const

const KEY_INDEX = new Map<string, number>(KEY_ORDER.map((k, i) => [k, i]))

// Relative major/minor pairs
const RELATIVE_PAIRS = new Map<string, string>([
  ['Cmaj', 'Amin'], ['Gmaj', 'Emin'], ['Dmaj', 'Bmin'],
  ['Amaj', 'F#min'], ['Emaj', 'C#min'], ['Bmaj', 'G#min'],
  ['F#maj', 'Ebmin'], ['Dbmaj', 'Bbmin'], ['Abmaj', 'Fmin'],
  ['Ebmaj', 'Cmin'], ['Bbmaj', 'Gmin'], ['Fmaj', 'Dmin'],
  ['Amin', 'Cmaj'], ['Emin', 'Gmaj'], ['Bmin', 'Dmaj'],
  ['F#min', 'Amaj'], ['C#min', 'Emaj'], ['G#min', 'Bmaj'],
  ['Ebmin', 'F#maj'], ['Bbmin', 'Dbmaj'], ['Fmin', 'Abmaj'],
  ['Cmin', 'Ebmaj'], ['Gmin', 'Bbmaj'], ['Dmin', 'Fmaj'],
])

// ── Core Computation ────────────────────────────────────────────────────────

/**
 * Compute similarity between two tracks. Returns 0-1.
 */
export function computeTrackSimilarity(
  a: TrackAttributes,
  b: TrackAttributes,
  weights: Readonly<SimilarityWeights> = DEFAULT_SIMILARITY_WEIGHTS,
): number {
  let totalScore = 0
  let totalWeight = 0

  // Genre overlap (Jaccard similarity)
  const genreSim = jaccardSimilarity(a.genres, b.genres)
  totalScore += genreSim * weights.genre
  totalWeight += weights.genre

  // Mood overlap (Jaccard)
  const moodSim = jaccardSimilarity(a.moods, b.moods)
  totalScore += moodSim * weights.mood
  totalWeight += weights.mood

  // BPM similarity (Gaussian decay, max difference ~ 40 BPM = ~0)
  const bpmSim = gaussianSimilarity(a.bpm, b.bpm, 20)
  totalScore += bpmSim * weights.bpm
  totalWeight += weights.bpm

  // Key similarity (circle of fifths distance)
  const keySim = keySimilarity(a.key, b.key)
  totalScore += keySim * weights.key
  totalWeight += weights.key

  // Continuous features: energy, danceability, acousticness, instrumentalness, valence
  totalScore += (1 - Math.abs(a.energy - b.energy)) * weights.energy
  totalWeight += weights.energy

  totalScore += (1 - Math.abs(a.danceability - b.danceability)) * weights.danceability
  totalWeight += weights.danceability

  totalScore += (1 - Math.abs(a.acousticness - b.acousticness)) * weights.acousticness
  totalWeight += weights.acousticness

  totalScore += (1 - Math.abs(a.instrumentalness - b.instrumentalness)) * weights.instrumentalness
  totalWeight += weights.instrumentalness

  totalScore += (1 - Math.abs(a.valence - b.valence)) * weights.valence
  totalWeight += weights.valence

  // Duration similarity (Gaussian, σ=60s)
  const durationSim = gaussianSimilarity(a.durationMs / 1000, b.durationMs / 1000, 60)
  totalScore += durationSim * weights.duration
  totalWeight += weights.duration

  // Language match (binary)
  if (a.language && b.language) {
    totalScore += (a.language === b.language ? 1 : 0) * weights.language
    totalWeight += weights.language
  }

  // Era similarity (Gaussian, σ=5 years)
  if (a.releaseYear && b.releaseYear) {
    const eraSim = gaussianSimilarity(a.releaseYear, b.releaseYear, 5)
    totalScore += eraSim * weights.era
    totalWeight += weights.era
  }

  return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 10000) / 10000 : 0
}

/**
 * Given a source track and a catalog, find the top N most similar tracks.
 * Returns ContentSimilarity objects compatible with the recommendation engine.
 */
export function findSimilarTracks(
  source: TrackAttributes,
  catalog: readonly TrackAttributes[],
  limit: number = 20,
  weights: Readonly<SimilarityWeights> = DEFAULT_SIMILARITY_WEIGHTS,
): ContentSimilarity[] {
  const scored: { trackId: string; score: number; sharedAttrs: string[] }[] = []

  for (const candidate of catalog) {
    if (candidate.trackId === source.trackId) continue

    const score = computeTrackSimilarity(source, candidate, weights)
    if (score <= 0) continue

    const sharedAttrs = identifySharedAttributes(source, candidate)
    scored.push({ trackId: candidate.trackId, score, sharedAttrs })
  }

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map((s) => ({
    sourceItemId: source.trackId,
    targetItemId: s.trackId,
    targetItemType: 'track' as const,
    similarityScore: s.score,
    sharedAttributes: s.sharedAttrs,
  }))
}

/**
 * Batch: for multiple source tracks, find similar tracks across the catalog.
 * Deduplicates by target, keeping the highest similarity score.
 */
export function batchFindSimilar(
  sources: readonly TrackAttributes[],
  catalog: readonly TrackAttributes[],
  limitPerSource: number = 10,
  totalLimit: number = 50,
  weights: Readonly<SimilarityWeights> = DEFAULT_SIMILARITY_WEIGHTS,
): ContentSimilarity[] {
  const best = new Map<string, ContentSimilarity>()

  for (const source of sources) {
    const similar = findSimilarTracks(source, catalog, limitPerSource, weights)
    for (const sim of similar) {
      const existing = best.get(sim.targetItemId)
      if (!existing || existing.similarityScore < sim.similarityScore) {
        best.set(sim.targetItemId, sim)
      }
    }
  }

  return Array.from(best.values())
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, totalLimit)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Jaccard similarity: |A ∩ B| / |A ∪ B|
 */
function jaccardSimilarity(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 1
  const setA = new Set(a.map((s) => s.toLowerCase()))
  const setB = new Set(b.map((s) => s.toLowerCase()))
  let intersection = 0
  for (const item of setA) {
    if (setB.has(item)) intersection++
  }
  const union = setA.size + setB.size - intersection
  return union > 0 ? intersection / union : 0
}

/**
 * Gaussian similarity: exp(-((a-b)^2) / (2σ^2))
 */
function gaussianSimilarity(a: number, b: number, sigma: number): number {
  const diff = a - b
  return Math.exp(-(diff * diff) / (2 * sigma * sigma))
}

/**
 * Key similarity based on circle of fifths distance + relative major/minor.
 */
function keySimilarity(keyA: string, keyB: string): number {
  if (keyA === keyB) return 1

  // Check relative major/minor pair
  if (RELATIVE_PAIRS.get(keyA) === keyB) return 0.9

  const idxA = KEY_INDEX.get(keyA)
  const idxB = KEY_INDEX.get(keyB)
  if (idxA === undefined || idxB === undefined) return 0.3 // unknown key

  // Circle of fifths distance within same quality (major or minor)
  // Both indices are in a 12-element half of the circle
  const halfSize = 12
  const qualityA = idxA < halfSize ? 'major' : 'minor'
  const qualityB = idxB < halfSize ? 'major' : 'minor'

  if (qualityA === qualityB) {
    const localA = idxA % halfSize
    const localB = idxB % halfSize
    const dist = Math.min(
      Math.abs(localA - localB),
      halfSize - Math.abs(localA - localB),
    )
    // Adjacent keys on circle: dist=1 → 0.8, dist=2 → 0.6, etc.
    return Math.max(0, 1 - dist * 0.2)
  }

  // Different quality, not relative pair
  return 0.4
}

/**
 * Identify which attributes are shared between two tracks (for explainability).
 */
function identifySharedAttributes(a: TrackAttributes, b: TrackAttributes): string[] {
  const shared: string[] = []

  const commonGenres = a.genres.filter((g) =>
    b.genres.some((bg) => bg.toLowerCase() === g.toLowerCase()),
  )
  if (commonGenres.length > 0) shared.push(`genre:${commonGenres[0]}`)

  const commonMoods = a.moods.filter((m) =>
    b.moods.some((bm) => bm.toLowerCase() === m.toLowerCase()),
  )
  if (commonMoods.length > 0) shared.push(`mood:${commonMoods[0]}`)

  if (Math.abs(a.bpm - b.bpm) <= 10) shared.push('similar-tempo')
  if (a.key === b.key) shared.push('same-key')
  if (Math.abs(a.energy - b.energy) <= 0.15) shared.push('similar-energy')
  if (a.language && b.language && a.language === b.language) shared.push(`lang:${a.language}`)

  return shared
}
