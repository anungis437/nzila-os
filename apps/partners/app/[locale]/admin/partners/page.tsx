import {
  UsersIcon as _UsersIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import { getAllPartners } from '@/lib/partner-auth'
import { PartnerTable } from '@/components/partner/PartnerTable'

export default async function PartnersManagementPage() {
  const allPartners = await getAllPartners()

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Partner Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            {allPartners.length} partners on the platform
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          <PlusIcon className="w-5 h-5" />
          Add Partner
        </button>
      </div>

      <PartnerTable partners={allPartners} />
    </div>
  )
}
