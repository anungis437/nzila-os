'use client'

import { useState } from 'react'
import { SearchModes } from '@nzila/platform-semantic-search'

const searchModes = Object.entries(SearchModes)

export default function SearchExplorer() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<string>(SearchModes.HYBRID)

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Semantic Search</h1>
      <p className="mb-6 text-gray-500">
        Lexical, semantic, and hybrid search across platform entities with
        ontology-aware filtering.
      </p>

      {/* Search Box */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex gap-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all platform entities..."
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {searchModes.map(([key, value]) => (
              <option key={key} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Search
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-400">
            Search Modes
          </h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="rounded bg-gray-50 px-3 py-2">
              <strong className="text-blue-600">lexical</strong> — Token-based
              matching with TF-IDF scoring and title boost
            </li>
            <li className="rounded bg-gray-50 px-3 py-2">
              <strong className="text-blue-600">semantic</strong> — Embedding-based
              cosine similarity via configurable EmbeddingProvider
            </li>
            <li className="rounded bg-gray-50 px-3 py-2">
              <strong className="text-blue-600">hybrid</strong> — 40% lexical +
              60% semantic weighted combination
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-400">
            Capabilities
          </h2>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>Org-isolated search per request</li>
            <li>Entity type filtering via ontology</li>
            <li>Tag-based filtering and boosting</li>
            <li>Pagination with offset and limit</li>
            <li>Batched indexing and reindexing</li>
            <li>Pluggable embedding provider interface</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
