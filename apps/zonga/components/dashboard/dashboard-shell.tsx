/**
 * Zonga — Dashboard Client Shell
 *
 * Wraps the dashboard content with client-side providers
 * (player context) and renders the persistent player bar.
 */
'use client'

import type { ReactNode } from 'react'
import { PlayerProvider, PlayerBar } from '@/components/player'

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <PlayerProvider>
      {children}
      <PlayerBar />
    </PlayerProvider>
  )
}
