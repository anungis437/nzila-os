import type { NzilaHqContext } from '@/lib/resolve-org'
import { PaletteTrigger } from './PaletteTrigger'

export function TopBar({ context }: { context: NzilaHqContext }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-3">
      <div className="text-xs text-slate-500">
        Executive cockpit · read-only aggregator across Console, Platform Admin, Control Plane
      </div>
      <div className="flex items-center gap-4 text-xs">
        <PaletteTrigger />
        <span className="text-slate-500">{context.email ?? context.userId}</span>
        <span className="rounded-full bg-slate-900 px-2 py-0.5 font-medium text-white">
          {context.role.replace('-', ' ')}
        </span>
      </div>
    </header>
  )
}
