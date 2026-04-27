interface KpiCardProps {
  title: string
  value: string
  description: string
  trend?: 'up' | 'down' | 'stable'
}

const trendIcon: Record<NonNullable<KpiCardProps['trend']>, string> = {
  up: '↑',
  down: '↓',
  stable: '→',
}

const trendColor: Record<NonNullable<KpiCardProps['trend']>, string> = {
  up: 'text-rose-500',
  down: 'text-emerald-500',
  stable: 'text-slate-400',
}

export function KpiCard({ title, value, description, trend }: KpiCardProps) {
  return (
    <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{title}</h3>
        {trend && (
          <span className={`text-sm font-bold ${trendColor[trend]}`}>
            {trendIcon[trend]}
          </span>
        )}
      </div>
      <div className="text-3xl font-extrabold text-slate-900 mb-1">{value}</div>
      <p className="text-xs text-slate-400">{description}</p>
    </div>
  )
}
