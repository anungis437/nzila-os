/**
 * EmptyState — consistent empty state placeholder.
 */

interface EmptyStateProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
  description?: string
  action?: {
    label: string
    href: string
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-slate-300" />
      </div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      {description && (
        <p className="text-xs text-slate-400 mt-1 max-w-sm">{description}</p>
      )}
      {action && (
        <a
          href={action.href}
          className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
        >
          {action.label}
        </a>
      )}
    </div>
  )
}
