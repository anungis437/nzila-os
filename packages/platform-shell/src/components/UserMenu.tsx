'use client';

import { useShell } from '../context/provider';

export function UserMenu() {
  const { user } = useShell();

  if (!user) return null;

  const initials = [user.firstName, user.lastName]
    .filter(Boolean)
    .map((n) => n!.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="flex items-center gap-2">
      {user.imageUrl ? (
        <img
          src={user.imageUrl}
          alt={`${user.firstName ?? 'User'}'s avatar`}
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
          {initials || '?'}
        </div>
      )}
      <span className="hidden text-sm font-medium text-gray-700 lg:inline">
        {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
      </span>
    </div>
  );
}
