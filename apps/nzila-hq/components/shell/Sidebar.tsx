'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { HqRole } from '@nzila/hq-domain'
import { NAV, NAV_GROUPS, NAV_GROUP_LABELS } from '@/lib/nav'
import { hasCapability } from '@/lib/rbac'

interface SidebarProps {
  role: HqRole
}

export function Sidebar({ role }: SidebarProps) {
  const activePath = usePathname() ?? '/home'
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="px-6 py-6">
        <Link href="/home" className="block">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
            Nzila Ventures
          </div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Nzila HQ</div>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {NAV_GROUPS.map((group) => {
          const items = NAV.filter((n) => n.group === group && hasCapability(role, n.capability))
          if (items.length === 0) return null
          return (
            <div key={group} className="mb-5">
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {NAV_GROUP_LABELS[group]}
              </div>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    activePath === item.href ||
                    (item.href !== '/home' && activePath.startsWith(item.href))
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block rounded-md px-3 py-1.5 text-sm font-medium transition ${
                          active
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>
      <div className="border-t border-slate-100 px-6 py-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Role</div>
        <div className="mt-0.5 text-sm font-semibold capitalize text-slate-900">
          {role.replace('-', ' ')}
        </div>
      </div>
    </aside>
  )
}
