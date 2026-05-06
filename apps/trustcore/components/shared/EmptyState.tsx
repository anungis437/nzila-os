/**
 * TrustCore — Empty State
 *
 * Generic empty-state component used across all TrustCore list views.
 */

interface EmptyStateProps {
  title: string
  description: string
  icon?: React.ComponentType<{ className?: string }>
}

export function EmptyState({ title, description, icon: Icon }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      {Icon && <Icon className="h-12 w-12 mx-auto mb-4 text-gray-300" />}
      <p className="text-lg font-medium text-gray-600">{title}</p>
      <p className="text-sm text-gray-400 mt-1">{description}</p>
    </div>
  )
}
