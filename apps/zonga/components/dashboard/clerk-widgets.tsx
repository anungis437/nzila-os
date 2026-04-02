'use client'

import { OrganizationSwitcher, useClerk, useUser } from '@clerk/nextjs'
import { User, Settings, LogOut } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export function SidebarOrgSwitcher() {
  return (
    <OrganizationSwitcher
      appearance={{
        elements: {
          rootBox: 'w-full',
          organizationSwitcherTrigger:
            'w-full bg-white/5 hover:bg-white/10 rounded-lg py-2 px-3 !text-white text-sm transition-colors',
          organizationPreviewMainIdentifier: '!text-white',
          organizationPreviewSecondaryIdentifier: '!text-gray-400',
          organizationSwitcherTriggerIcon: '!text-white',
        },
      }}
    />
  )
}

export function SidebarAccountFooter({ locale }: { locale: string }) {
  const { user } = useUser()
  const { signOut } = useClerk()

  const displayName = user?.fullName ?? user?.firstName ?? 'Account'
  const email = user?.primaryEmailAddress?.emailAddress ?? ''
  const avatarUrl = user?.imageUrl

  return (
    <div className="space-y-1">
      {/* User identity */}
      <div className="flex items-center gap-3 px-3 py-2 mb-1">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-electric/20 flex items-center justify-center shrink-0">
            <User size={14} className="text-electric" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{displayName}</p>
          {email && <p className="text-[11px] text-gray-400 truncate">{email}</p>}
        </div>
      </div>

      {/* Settings */}
      <Link
        href={`/${locale}/dashboard/settings`}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
      >
        <Settings size={16} />
        Settings
      </Link>

      {/* Sign Out */}
      <button
        type="button"
        onClick={() => signOut({ redirectUrl: '/' })}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
      >
        <LogOut size={16} />
        Sign Out
      </button>
    </div>
  )
}

export function MobileAccountFooter({ locale }: { locale: string }) {
  const { user } = useUser()
  const { signOut } = useClerk()

  const displayName = user?.fullName ?? user?.firstName ?? 'Account'
  const avatarUrl = user?.imageUrl

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-electric/20 flex items-center justify-center">
            <User size={14} className="text-electric" />
          </div>
        )}
        <span className="text-sm font-medium text-white truncate">{displayName}</span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/${locale}/dashboard/settings`}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Settings"
        >
          <Settings size={16} />
        </Link>
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: '/' })}
          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  )
}
