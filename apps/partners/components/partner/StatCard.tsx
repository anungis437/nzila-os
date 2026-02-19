/**
 * StatCard — reusable KPI card for dashboards.
 */

interface StatCardProps {
  label: string
  value: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  change?: string | null
  changeDirection?: 'up' | 'down'
  subtitle?: string
}

export function StatCard({ label, value, icon: Icon, change, changeDirection = 'up', subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition">
      <div className="flex items-center justify-between">
        <Icon className="w-5 h-5 text-slate-400" />
        {change && (
          <span
            className={`flex items-center text-xs font-medium ${
              changeDirection === 'up' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {change}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
      {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}
