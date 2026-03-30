import {
  FolderOpenIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  PresentationChartBarIcon,
  PhotoIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline'

interface AssetCategory {
  id: string
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  count: number
}

const categories: AssetCategory[] = [
  { id: 'pitch-decks', label: 'Pitch Decks', icon: PresentationChartBarIcon, count: 0 },
  { id: 'one-pagers', label: 'One-Pagers', icon: DocumentTextIcon, count: 0 },
  { id: 'social-graphics', label: 'Social Graphics', icon: PhotoIcon, count: 0 },
  { id: 'email-templates', label: 'Email Templates', icon: EnvelopeIcon, count: 0 },
  { id: 'case-studies', label: 'Case Studies', icon: DocumentTextIcon, count: 0 },
  { id: 'brand-assets', label: 'Brand Assets', icon: FolderOpenIcon, count: 0 },
]

export default function AssetsPage() {
  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Asset Library</h1>
          <p className="mt-1 text-sm text-slate-500">
            Co-branded marketing collateral ready to download and customise.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition shadow-sm">
          <ArrowDownTrayIcon className="w-4 h-4" />
          Download All
        </button>
      </div>

      {/* Search */}
      <div className="mt-6 relative">
        <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search assets by name, category, or tag…"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Categories */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className="bg-white rounded-xl border border-slate-200 p-4 text-center hover:shadow-sm hover:border-blue-200 transition group"
          >
            <cat.icon className="w-6 h-6 text-slate-400 group-hover:text-blue-600 mx-auto transition" />
            <p className="text-sm font-medium text-slate-700 mt-2">{cat.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{cat.count} assets</p>
          </button>
        ))}
      </div>

      {/* Asset grid */}
      <div className="mt-8 bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">All Assets</h2>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700">Grid</button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-50">List</button>
          </div>
        </div>

        {/* Empty state */}
        <div className="px-6 py-16 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-50 mb-4">
            <FolderOpenIcon className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm text-slate-500 font-medium">Asset library is being prepared</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Co-branded materials including pitch decks, one-pagers, social graphics, and email
            templates will appear here once your partnership is activated.
          </p>
        </div>
      </div>

      {/* White-label generator teaser */}
      <div className="mt-6 p-5 bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl">
        <p className="text-sm font-semibold text-blue-900">White-Label Asset Generator</p>
        <p className="text-xs text-blue-700 mt-1 leading-relaxed">
          Upload your logo and enter your company details to generate instantly branded one-pagers,
          pitch decks, and social assets. Available for Select tier and above.
        </p>
      </div>
    </div>
  )
}
