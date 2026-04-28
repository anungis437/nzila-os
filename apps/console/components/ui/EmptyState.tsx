/**
 * Console EmptyState — calm placeholder for "no data yet" surfaces.
 *
 * Keep copy concrete: tell the operator WHY it's empty and WHAT to do.
 */
import { cn } from './cn'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  /** Primary call-to-action — usually an <a> or <Button>. */
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center p-10', className)}>
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-gray-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
