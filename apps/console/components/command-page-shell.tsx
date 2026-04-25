import type { ReactNode } from 'react'

export function CommandPageShell({
  children,
  className = '',
  as = 'main',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'main' | 'section'
}) {
  const Component = as

  return (
    <Component className={`mx-auto w-full max-w-7xl px-6 py-8 lg:px-8 ${className}`.trim()}>
      {children}
    </Component>
  )
}