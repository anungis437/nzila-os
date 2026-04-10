/**
 * WorkspaceIdentity — Displays the workspace identity in app chrome.
 *
 * Pattern: "Zonga | MS Célébration Workspace"
 * Zonga is always primary. Client name appears as text-only secondary.
 */
'use client'

import type { BrandAsset, BrandPlacement, BrandingFeatureFlags } from '@/lib/branding/types'
import { ZongaBrandMark } from './ZongaBrandMark'
import { canRenderBrand, getWorkspaceDisplayName } from '@/lib/branding/policy'

interface WorkspaceIdentityProps {
  placement: BrandPlacement
  client?: BrandAsset
  flags?: BrandingFeatureFlags
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function WorkspaceIdentity({
  placement,
  client,
  flags,
  size = 'md',
  className = '',
}: WorkspaceIdentityProps) {
  const showClient =
    client && canRenderBrand('client', placement, 'text_only', flags)

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <ZongaBrandMark placement={placement} size={size} />
      {showClient && (
        <>
          <span className="text-white/30">|</span>
          <span className="text-sm font-medium text-white/60 truncate max-w-50">
            {getWorkspaceDisplayName(client.name)}
          </span>
        </>
      )}
    </div>
  )
}
