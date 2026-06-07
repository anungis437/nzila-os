import Link from 'next/link'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { Card, CardBody } from '@/components/ui'

/**
 * LegacyBridge — subordination frame.
 *
 * Renders the "related legacy surfaces" link grid that subordinates the
 * existing (dashboard) routes under a workspace sub-tab, per the Workspace
 * Doctrine §5 (docs/doctrine/NZILA_CONSOLE_WORKSPACE_MAP.md). Legacy routes
 * are never deleted — they are framed inside the workspace that owns them.
 */
export interface BridgeLink {
  name: string
  href: string
  description: string
}

export function LegacyBridge({
  title = 'Related surfaces',
  intro,
  links,
}: {
  title?: string
  intro?: string
  links: BridgeLink[]
}) {
  if (links.length === 0) return null
  return (
    <section className="mt-8 border-t border-gray-100 pt-6">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">{title}</h3>
      {intro ? <p className="mt-1 text-sm text-gray-500">{intro}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card interactive className="h-full">
              <CardBody>
                <div className="flex items-start justify-between">
                  <span className="text-sm font-semibold text-gray-900">{link.name}</span>
                  <ArrowRightIcon className="h-4 w-4 text-gray-300" />
                </div>
                <p className="mt-2 text-sm text-gray-500">{link.description}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
