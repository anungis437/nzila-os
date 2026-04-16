"use client";

import { Bell, LogOut, Search } from "lucide-react";
import { useAuthActions } from '@nzila/platform-auth/entra/client';
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

export function HeaderActions() {
  const locale = useLocale();
  const { signOut } = useAuthActions();
  const [notificationCount, setNotificationCount] = useState(0);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    groups?: Record<string, Array<Record<string, unknown>>>;
  } | null>(null);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await fetch("/api/notifications/count");
        if (response.ok) {
          const json = await response.json();
          // withApi wraps responses in { success, data: { ... } }
          const data = json.data ?? json;
          setNotificationCount(data.count || 0);
        }
      } catch {
        setNotificationCount(0);
      }
    };

    loadNotifications();

    // Poll every 60 seconds
    const interval = setInterval(loadNotifications, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }

    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/universal?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        setSearchResults(json?.data ?? null);
      } catch {
        setSearchResults(null);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative hidden md:block">
        <div className="flex items-center rounded-md border border-gray-300 bg-white px-2">
          <Search className="h-4 w-4 text-gray-500" />
          <input
            value={query}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cases, docs, members"
            className="w-64 border-0 bg-transparent px-2 py-1.5 text-sm outline-none"
          />
        </div>
        {open && query.trim().length >= 2 && searchResults?.groups && (
          <div className="absolute right-0 top-11 z-30 max-h-96 w-130 overflow-auto rounded-md border bg-white p-3 shadow-lg">
            {(['cases', 'documents', 'members', 'agreements', 'tasksAndNotes'] as const).map((group) => {
              const items = searchResults.groups?.[group] ?? [];
              if (!items.length) {
                return null;
              }
              return (
                <div key={group} className="mb-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{group}</p>
                  <div className="space-y-1">
                    {items.slice(0, 4).map((item) => {
                      const id = String(item.id ?? item.grievanceId ?? '');
                      const label = String(item.title ?? item.name ?? item.notes ?? item.grievanceNumber ?? item.cbaNumber ?? id);
                      const href =
                        group === 'cases'
                          ? `/${locale}/dashboard/grievances/${id}`
                          : group === 'documents'
                            ? `/${locale}/dashboard/documents`
                            : group === 'members'
                              ? `/${locale}/dashboard/members`
                              : group === 'agreements'
                                ? `/${locale}/dashboard/agreements`
                                : `/${locale}/dashboard/grievances/${String(item.grievanceId ?? '')}`;

                      return (
                        <Link
                          key={`${group}:${id}:${label}`}
                          href={href}
                          className="block rounded px-2 py-1.5 text-sm hover:bg-gray-50"
                        >
                          <p className="font-medium text-gray-800">{label}</p>
                          {'privacyLabel' in item && (
                            <p className="text-xs text-amber-700">{String(item.privacyLabel ?? '')}</p>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notification Bell — always visible */}
      <Button variant="ghost" size="icon" className="relative" asChild>
        <Link href={`/${locale}/dashboard/notifications`}>
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
              {notificationCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Link>
      </Button>

      {/* Logout */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => signOut("/")}
        title="Sign out"
      >
        <LogOut className="h-5 w-5" />
        <span className="sr-only">Sign out</span>
      </Button>
    </div>
  );
}
