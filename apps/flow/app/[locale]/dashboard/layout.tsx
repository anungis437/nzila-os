"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { OrgPicker } from "@/app/(dashboard)/components/org-picker";
import {
  HomeIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ShoppingCartIcon,
  BanknotesIcon,
  CubeIcon,
  ArchiveBoxIcon,
  TruckIcon,
  ClipboardDocumentListIcon,
  WrenchScrewdriverIcon,
  ChartBarIcon,
  LinkIcon,
  ArrowDownTrayIcon,
  ServerIcon,
  CogIcon,
} from "@heroicons/react/24/outline";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [
      { href: "overview", label: "Overview", icon: HomeIcon },
    ],
  },
  {
    label: "Sales & Commerce",
    items: [
      { href: "quotes", label: "Quotes", icon: DocumentTextIcon },
      { href: "clients", label: "Clients", icon: UserGroupIcon },
      { href: "orders", label: "Orders", icon: ShoppingCartIcon },
      { href: "invoices", label: "Invoices", icon: BanknotesIcon },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "products", label: "Products", icon: CubeIcon },
      { href: "inventory", label: "Inventory", icon: ArchiveBoxIcon },
      { href: "suppliers", label: "Suppliers", icon: TruckIcon },
      { href: "purchase-orders", label: "Purchase Orders", icon: ClipboardDocumentListIcon },
      { href: "production", label: "Production", icon: WrenchScrewdriverIcon },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "analytics", label: "Analytics", icon: ChartBarIcon },
    ],
  },
  {
    label: "System",
    items: [
      { href: "integrations", label: "Integrations", icon: LinkIcon },
      { href: "import", label: "Legacy Import", icon: ArrowDownTrayIcon },
      { href: "system", label: "System Status", icon: ServerIcon },
      { href: "settings", label: "Settings", icon: CogIcon },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const localeMatch = pathname.match(/^\/(en-CA|fr-CA)/);
  const locale = localeMatch?.[1] ?? "en-CA";
  const basePath = `/${locale}/dashboard`;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric font-poppins text-xs font-bold text-white">
            SQ
          </div>
          <span className="font-poppins text-sm font-semibold text-navy">
            Flow
          </span>
        </div>
        <OrgPicker />
        <nav className="flex-1 space-y-4 overflow-y-auto p-4">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
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
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-electric/10 text-electric"
                          : "text-slate-600 hover:bg-slate-50 hover:text-navy"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

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
