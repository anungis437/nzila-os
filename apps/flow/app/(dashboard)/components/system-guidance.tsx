/**
 * Contextual guidance banner for detail pages.
 *
 * Shows what the user needs to do next (info), a warning about a
 * potential blocker, or an error-level alert.  Renders as a coloured
 * banner with an icon on the left.
 */
import {
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  CheckCircleIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'

type Severity = 'info' | 'success' | 'warning' | 'error' | 'tip'

const SEVERITY_STYLES: Record<
  Severity,
  { border: string; bg: string; text: string; icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  info:    { border: 'border-blue-200',    bg: 'bg-blue-50',    text: 'text-blue-800',    icon: InformationCircleIcon },
  success: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800', icon: CheckCircleIcon },
  warning: { border: 'border-amber-200',   bg: 'bg-amber-50',   text: 'text-amber-800',   icon: ExclamationTriangleIcon },
  error:   { border: 'border-red-200',     bg: 'bg-red-50',     text: 'text-red-800',     icon: XCircleIcon },
  tip:     { border: 'border-violet-200',  bg: 'bg-violet-50',  text: 'text-violet-800',  icon: LightBulbIcon },
}

export function SystemGuidance({
  severity = 'info',
  title,
  children,
  className = '',
}: {
  severity?: Severity
  title?: string
  children: React.ReactNode
  className?: string
}) {
  const style = SEVERITY_STYLES[severity]
  const Icon = style.icon

  return (
    <div className={`flex items-start gap-3 rounded-xl border ${style.border} ${style.bg} p-4 ${className}`}>
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${style.text}`} />
      <div className="min-w-0 text-sm">
        {title && <p className={`font-semibold ${style.text} mb-0.5`}>{title}</p>}
        <div className={`${style.text} leading-relaxed`}>{children}</div>
      </div>
    </div>
  )
}
