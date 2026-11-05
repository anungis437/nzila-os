"use client";

import { LogOut } from "lucide-react";
import { useAuthActions } from '@nzila/platform-auth/entra/client';
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { inboxPathFor } from "@/lib/notifications/inbox-links";
import { useLocale } from "next-intl";

export function HeaderActions({ userRole }: { userRole?: string | null }) {
  const { signOut } = useAuthActions();
  const label = useLocale() === 'fr-CA' ? 'Se déconnecter' : 'Sign out';
  // The bell is drawn only where the person has a page that shows their inbox; a role the dashboard sends away from it gets no bell.
  const inboxPath = inboxPathFor(userRole);

  return (
    <div className="flex items-center gap-2">
      {inboxPath !== null && <NotificationBell path={inboxPath} />}
      {/* Logout */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => signOut("/")}
        title={label}
      >
        <LogOut className="h-5 w-5" />
        <span className="sr-only">{label}</span>
      </Button>
    </div>
  );
}
