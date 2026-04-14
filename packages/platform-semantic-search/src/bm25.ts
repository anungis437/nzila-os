/**
 * @nzila/platform-semantic-search — BM25 Scoring
 *
 * Okapi BM25 — the industry-standard probabilistic ranking function used by
 * Elasticsearch, Solr, and Lucene. Replaces the naive token-overlap lexical
 * scoring with proper term frequency × inverse document frequency accounting
 * for document length normalisation.
 *
 * Reference: Robertson & Zaragoza, "The Probabilistic Relevance Framework:
 * BM25 and Beyond", Foundations and Trends in Information Retrieval, 2009.
 */

// ── Tokenisation ────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor',
  'not', 'so', 'no', 'if', 'it', 'its', 'this', 'that', 'these', 'those',
  'my', 'your', 'his', 'her', 'our', 'their', 'what', 'which', 'who',
  'whom', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both',
  'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same',
  'than', 'too', 'very', 'just', 'about', 'also', 'here', 'there',
])

/** Simple Porter-like stem: strips common English suffixes */
function stem(word: string): string {
  if (word.length <= 3) return word
  // -ing, -tion, -sion, -ness, -ment, -ful, -less, -able, -ible, -ly, -ed, -er, -es, -s
  return word
    .replace(/ation$/, 'ate')
    .replace(/(tion|sion)$/, '')
    .replace(/ness$/, '')
    .replace(/ment$/, '')
    .replace(/ful$/, '')
    .replace(/less$/, '')
    .replace(/(able|ible)$/, '')
    .replace(/ing$/, '')
    .replace(/ly$/, '')
    .replace(/ed$/, '')
    .replace(/er$/, '')
    .replace(/ies$/, 'y')
    .replace(/es$/, '')
    .replace(/s$/, '')
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .map(stem)
}

// ── Term Frequency Map ──────────────────────────────────────────────────────

export interface TermFrequency {
  readonly terms: ReadonlyMap<string, number>
  readonly length: number
}

export function computeTermFrequency(text: string): TermFrequency {
  const tokens = tokenize(text)
  const terms = new Map<string, number>()
  for (const t of tokens) {
    terms.set(t, (terms.get(t) ?? 0) + 1)
  }
  return { terms, length: tokens.length }
}

// ── BM25 Index ──────────────────────────────────────────────────────────────

export interface BM25Params {
  /** Term frequency saturation. Default 1.2 (classic) */
  readonly k1?: number
  /** Length normalisation. Default 0.75 (classic) */
  readonly b?: number
  /** Title boost multiplier for terms found in title. Default 1.5 */
  readonly titleBoost?: number
}

export interface BM25Document {
  readonly id: string
  readonly bodyTf: TermFrequency
  readonly titleTf: TermFrequency
}

export interface BM25Index {
  addDocument(id: string, title: string, body: string): void
  removeDocument(id: string): void
  /** Score a single document against query terms */
  score(queryText: string, docId: string): number
  /** Score ALL indexed documents, return sorted (descending) */
  scoreAll(queryText: string): Array<{ id: string; score: number }>
  readonly size: number
}

/**
 * Creates a BM25 index that maintains inverted document-frequency statistics
 * and computes Okapi BM25 scores.
 */
export function createBM25Index(params?: BM25Params): BM25Index {
  const k1 = params?.k1 ?? 1.2
  const b = params?.b ?? 0.75
  const titleBoost = params?.titleBoost ?? 1.5

  const docs = new Map<string, BM25Document>()
  /** term → set of document IDs containing the term */
  const invertedIndex = new Map<string, Set<string>>()
  let totalBodyLength = 0

  function avgDocLength(): number {
    return docs.size === 0 ? 0 : totalBodyLength / docs.size
  }

  /** IDF using the BM25 variant: log((N - n + 0.5) / (n + 0.5) + 1) */
  function idf(term: string): number {
    const n = invertedIndex.get(term)?.size ?? 0
    const N = docs.size
    return Math.log((N - n + 0.5) / (n + 0.5) + 1)
  }

  function addToInvertedIndex(id: string, tf: TermFrequency): void {
    for (const term of tf.terms.keys()) {
      let set = invertedIndex.get(term)
      if (!set) {
        set = new Set()
        invertedIndex.set(term, set)
      }
      set.add(id)
    }
  }

  function removeFromInvertedIndex(id: string, tf: TermFrequency): void {
    for (const term of tf.terms.keys()) {
      const set = invertedIndex.get(term)
      if (set) {
        set.delete(id)
        if (set.size === 0) invertedIndex.delete(term)
      }
    }
  }

  function scoreDocument(queryTerms: string[], doc: BM25Document): number {
    const avgdl = avgDocLength()
    let total = 0

    for (const qt of queryTerms) {
      const termIdf = idf(qt)

      // Body score
      const fBody = doc.bodyTf.terms.get(qt) ?? 0
      const bodyNorm =
        fBody * (k1 + 1) / (fBody + k1 * (1 - b + b * (doc.bodyTf.length / (avgdl || 1))))
      total += termIdf * bodyNorm

      // Title boost — title matches are more relevant
      const fTitle = doc.titleTf.terms.get(qt) ?? 0
      if (fTitle > 0) {
        total += termIdf * titleBoost
      }
    }

    return total
  }

  return {
    get size() {
      return docs.size
    },

    addDocument(id, title, body) {
      // Remove old if exists
      const existing = docs.get(id)
      if (existing) {
        totalBodyLength -= existing.bodyTf.length
        removeFromInvertedIndex(id, existing.bodyTf)
        removeFromInvertedIndex(id, existing.titleTf)
      }

      const bodyTf = computeTermFrequency(body)
      const titleTf = computeTermFrequency(title)
      const doc: BM25Document = { id, bodyTf, titleTf }
      docs.set(id, doc)
      totalBodyLength += bodyTf.length
      addToInvertedIndex(id, bodyTf)
      addToInvertedIndex(id, titleTf)
    },

    removeDocument(id) {
      const doc = docs.get(id)
      if (!doc) return
      totalBodyLength -= doc.bodyTf.length
      removeFromInvertedIndex(id, doc.bodyTf)
      removeFromInvertedIndex(id, doc.titleTf)
      docs.delete(id)
    },

    score(queryText, docId) {
      const doc = docs.get(docId)
      if (!doc) return 0
      const queryTerms = tokenize(queryText)
      if (queryTerms.length === 0) return 0
      return scoreDocument(queryTerms, doc)
    },

    scoreAll(queryText) {
      const queryTerms = tokenize(queryText)
      if (queryTerms.length === 0) return []

      // Optimisation: only consider documents that contain at least one query term
      const candidateIds = new Set<string>()
      for (const qt of queryTerms) {
        const docIds = invertedIndex.get(qt)
        if (docIds) {
          for (const id of docIds) candidateIds.add(id)
        }
      }

      const results: Array<{ id: string; score: number }> = []
      for (const id of candidateIds) {
        const doc = docs.get(id)!
        const s = scoreDocument(queryTerms, doc)
        if (s > 0) results.push({ id, score: s })
      }

      results.sort((a, b) => b.score - a.score)
      return results
    },
  }
}

// ── Reciprocal Rank Fusion ──────────────────────────────────────────────────

/**
 * Reciprocal Rank Fusion (RRF) — merges ranked lists from heterogeneous
 * retrieval systems (e.g. BM25 lexical + vector semantic) into a single
 * ranking. Each document's fused score is Σ 1 / (k + rank_i) across all
 * systems where it appears.
 *
 * Reference: Cormack, Clarke & Butt, "Reciprocal Rank Fusion outperforms
 * Condorcet and individual Rank Learning Methods", SIGIR 2009.
 *
 * @param rankedLists - Array of ranked result lists. Each list is assumed to
 *   be sorted by score descending. Items are identified by their `id` field.
 * @param k - Smoothing constant (default 60 per the original paper).
 */
export function reciprocalRankFusion<T extends { id: string }>(
  rankedLists: ReadonlyArray<readonly T[]>,
  k: number = 60,
): Array<{ item: T; score: number }> {
  const scoreMap = new Map<string, { item: T; score: number }>()

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank]
      const existing = scoreMap.get(item.id)
      const contribution = 1 / (k + rank + 1)
      if (existing) {
        existing.score += contribution
      } else {
        scoreMap.set(item.id, { item, score: contribution })
      }
    }
  }

  const fused = Array.from(scoreMap.values())
  fused.sort((a, b) => b.score - a.score)
  return fused
}

// ── Query Expansion ─────────────────────────────────────────────────────────

/**
 * Pseudo-relevance feedback query expansion.
 *
 * After an initial retrieval pass, extract frequent terms from the top-k
 * results and add them to the query to improve recall on subsequent passes.
 * This is a simplified variant of Rocchio's algorithm adapted for BM25.
 */
export interface QueryExpansionResult {
  readonly originalTerms: readonly string[]
  readonly expansionTerms: readonly string[]
  readonly expandedQuery: string
}

export function expandQuery(
  originalQuery: string,
  topDocTexts: readonly string[],
  maxExpansionTerms: number = 5,
): QueryExpansionResult {
  const originalTerms = tokenize(originalQuery)
  const originalSet = new Set(originalTerms)

  // Count term frequencies across all top documents
  const termCounts = new Map<string, number>()
  for (const text of topDocTexts) {
    const tf = computeTermFrequency(text)
    for (const [term, count] of tf.terms) {
      if (!originalSet.has(term)) {
        termCounts.set(term, (termCounts.get(term) ?? 0) + count)
      }
    }
  }

  // Sort by frequency and take top-k as expansion terms
  const sorted = Array.from(termCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxExpansionTerms)
    .map(([term]) => term)

  return {
    originalTerms,
    expansionTerms: sorted,
    expandedQuery: [...originalTerms, ...sorted].join(' '),
  }
}
