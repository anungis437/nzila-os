"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  DollarSign,
  TrendingUp,
  Target,
  Shield,
  Calendar,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/money", label: "Money", icon: DollarSign },
  { href: "/growth", label: "Growth", icon: TrendingUp },
  { href: "/focus", label: "Focus", icon: Target },
  { href: "/risks", label: "Risks", icon: Shield },
  { href: "/weekly", label: "Weekly", icon: Calendar },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter(Boolean);
  const activeLocale = pathSegments[0] ?? "en-CA";

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-sidebar">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <span className="text-base font-bold text-foreground tracking-tight">
          Week<span className="text-electric">One</span>
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const localizedHref = `/${activeLocale}${href}`;
          const isActive =
            pathname === localizedHref || pathname.startsWith(`${localizedHref}/`);
          return (
            <Link
              key={href}
              href={localizedHref}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
