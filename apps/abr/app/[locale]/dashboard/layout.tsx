"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const sidebarItems = [
  { href: "overview",   label: "Overview",    icon: "📊" },
  { href: "cases",      label: "Cases",       icon: "⚖️" },
  { href: "research",   label: "Research",    icon: "🔍" },
  { href: "analytics",  label: "Analytics",   icon: "📈" },
  { href: "reports",    label: "Reports",     icon: "📋" },
  { href: "compliance", label: "Compliance",  icon: "🛡️" },
  { href: "settings",   label: "Settings",    icon: "⚙️" },
];

export default function DashboardLayout({
  children,
  params: _params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const pathname = usePathname();
  // Extract locale from pathname (e.g., /en-CA/dashboard/overview)
  const localeMatch = pathname.match(/^\/(en-CA|fr-CA)/);
  const locale = localeMatch?.[1] ?? "en-CA";
  const basePath = `/${locale}/dashboard`;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric font-poppins text-xs font-bold text-white">
            CL
          </div>
          <span className="font-poppins text-sm font-semibold text-navy">
            CourtLens
          </span>
        </div>
        <nav className="space-y-1 p-4">
          {sidebarItems.map((item) => {
            const href =
              item.href === "overview"
                ? basePath
                : `${basePath}/${item.href}`;
            const isActive =
              item.href === "overview"
                ? pathname === basePath
                : pathname.startsWith(`${basePath}/${item.href}`);
            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-electric/10 text-electric"
                    : "text-slate-600 hover:bg-slate-50 hover:text-navy"
                )}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
          <h1 className="font-poppins text-lg font-semibold text-navy">
            Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              {locale === "fr-CA" ? "Français" : "English"}
            </span>
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
