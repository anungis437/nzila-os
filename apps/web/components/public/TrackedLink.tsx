'use client'

import Link from 'next/link'
import type { ComponentProps, MouseEvent } from 'react'
import { trackEvent, type TelemetryProperties } from '@/lib/telemetry'

type CommonProps = {
  eventName?: string
  eventProps?: TelemetryProperties
  external?: boolean
  onClick?: (event: MouseEvent<HTMLElement>) => void
}

type TrackedLinkProps = Omit<ComponentProps<typeof Link>, 'onClick'> &
  Omit<ComponentProps<'a'>, 'href' | 'onClick'> &
  CommonProps

export default function TrackedLink({
  href,
  eventName,
  eventProps,
  external = false,
  onClick,
  children,
  ...rest
}: TrackedLinkProps) {
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    onClick?.(event)
    if (!eventName) {
      return
    }
    trackEvent(eventName, {
      href: typeof href === 'string' ? href : href.toString(),
      ...eventProps,
    })
  }

  if (external) {
    return (
      <a href={typeof href === 'string' ? href : href.toString()} onClick={handleClick} {...rest}>
        {children}
      </a>
    )
  }

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  )
}
