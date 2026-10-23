"use client";

import { LogOut } from "lucide-react";
import { useAuthActions } from '@nzila/platform-auth/entra/client';
import { Button } from "@/components/ui/button";
import { useLocale } from "next-intl";

export function HeaderActions() {
  const { signOut } = useAuthActions();
  const label = useLocale() === 'fr-CA' ? 'Se déconnecter' : 'Sign out';

  return (
    <div className="flex items-center gap-2">
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
