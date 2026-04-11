"use client";

import { Bell, LogOut } from "lucide-react";
import { useAuthActions } from '@nzila/platform-auth/entra/client';
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

export function HeaderActions() {
  const locale = useLocale();
  const { signOut } = useAuthActions();
  const [notificationCount, setNotificationCount] = useState(0);

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

  return (
    <div className="flex items-center gap-2">
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
