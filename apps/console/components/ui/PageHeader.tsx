/**
 * Console PageHeader — premium top-of-page anatomy.
 *
 * Title (h1) + optional eyebrow, description, badges, and right-aligned actions.
 * Server component. Apply once at the top of every dashboard route.
 */
import { cn } from './cn'

export function PageHeader({
  eyebrow,
  title,
  description,
  badges,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  badges?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-500">{eyebrow}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="truncate text-2xl font-semibold text-gray-900 tracking-tight md:text-3xl">
            {title}
          </h1>
          {badges}
        </div>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm text-gray-600">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}
