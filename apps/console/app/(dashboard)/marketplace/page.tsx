/**
 * Nzila OS — Integration Marketplace
 * Installable provider connectors with manifest-driven configuration.
 * Install / uninstall providers, view status, inspect redacted config.
 * @see @nzila/platform-marketplace
 */
import { requireRole } from '@/lib/rbac'
import { getMarketplaceProviders, type MarketplaceProvider } from '@/lib/server-data'
import {
  PuzzlePieceIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  KeyIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

type Provider = MarketplaceProvider

function StatusBadge({ status }: { status: Provider['status'] }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <CheckCircleIcon className="h-3.5 w-3.5" /> Active
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        <XCircleIcon className="h-3.5 w-3.5" /> Error
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      Not installed
    </span>
  )
}

function ProviderCard({ provider }: { provider: Provider }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-sm transition">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${provider.installed ? 'bg-blue-50' : 'bg-gray-50'}`}>
            <PuzzlePieceIcon className={`h-6 w-6 ${provider.installed ? 'text-blue-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{provider.name}</h3>
            <p className="text-xs text-gray-500">{provider.category} · v{provider.version}</p>
          </div>
        </div>
        <StatusBadge status={provider.status} />
      </div>

      <p className="text-sm text-gray-600 mb-4 leading-relaxed">{provider.description}</p>

      {/* Scopes */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-500 mb-1">Scopes</p>
        <div className="flex flex-wrap gap-1">
          {provider.scopes.map((scope) => (
            <span key={scope} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
              {scope}
            </span>
          ))}
        </div>
      </div>

      {/* Secrets */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-500 mb-1">Required Secrets</p>
        <div className="flex flex-wrap gap-1">
          {provider.requiredSecrets.map((secret) => (
            <span key={secret} className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-mono">
              <KeyIcon className="h-3 w-3" /> {secret}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          <ArrowPathIcon className="h-3.5 w-3.5 inline mr-1" />
          Retry: {provider.retryAttempts}x · Health: {provider.lastHealthCheck}
        </div>
        {provider.installed ? (
          <button className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1 rounded-md hover:bg-red-50 transition">
            Uninstall
          </button>
        ) : (
          <button className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded-md hover:bg-blue-50 transition">
            Install
          </button>
        )}
      </div>
    </div>
  )
}

export default async function MarketplacePage({
  searchParams,
}: { searchParams: Promise<{ category?: string }> }) {
  await requireRole('platform_admin', 'studio_admin')
  const params = await searchParams
  const categoryFilter = params.category
  const providers = await getMarketplaceProviders()

  const filtered = categoryFilter
    ? providers.filter((p) => p.category === categoryFilter)
    : providers

  const categories = [...new Set(providers.map((p) => p.category))]
  const installedCount = providers.filter((p) => p.installed).length

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Integration Marketplace</h1>
          <p className="text-gray-500 mt-1">
            {installedCount} of {providers.length} providers installed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PuzzlePieceIcon className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-500">Manifest-driven connectors</span>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 mb-6">
        <a
          href="/marketplace"
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
            !categoryFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </a>
        {categories.map((cat) => (
          <a
            key={cat}
            href={`/marketplace?category=${cat}`}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition capitalize ${
              categoryFilter === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </a>
        ))}
      </div>

      {/* Provider Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <PuzzlePieceIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No providers in this category</p>
          <p className="text-sm mt-1">Try selecting a different category or view all providers</p>
        </div>
      )}
    </div>
  )
}
