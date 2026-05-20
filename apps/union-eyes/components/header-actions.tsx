"use client";

import { LogOut, Search } from "lucide-react";
import { useAuthActions } from '@nzila/platform-auth/entra/client';
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function HeaderActions() {
  const { signOut } = useAuthActions();
  const [query, setQuery] = useState('');

  return (
    <div className="flex items-center gap-2">
      <div className="relative hidden md:block">
        <div className="flex items-center rounded-md border border-gray-300 bg-white px-2">
          <Search className="h-4 w-4 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cases, agreements, dates"
            className="w-64 border-0 bg-transparent px-2 py-1.5 text-sm outline-none"
          />
        </div>
      </div>

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
