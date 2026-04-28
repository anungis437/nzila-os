/**
 * Console Badge primitive — categorical labels.
 *
 * For status semantics, prefer <StatusPill>. Use <Badge> for neutral tags
 * (e.g. environment, region, taxonomy).
 */
import { cn } from './cn'

type Tone = 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'violet'

const TONES: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700 ring-gray-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
}

export function Badge({
  tone = 'gray',
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
}
