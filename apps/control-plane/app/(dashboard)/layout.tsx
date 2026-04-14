"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Shield,
  Brain,
  AlertTriangle,
  Bot,
  Boxes,
  FileCheck,
  GitPullRequest,
  Calendar,
  Server,
  Scale,
  PieChart,
  Landmark,
  TrendingUp,
  Rocket,
  Database,
  Bell,
  Handshake,
  FileText,
  Building2,
  ShieldCheck,
  Radio,
} from "lucide-react";

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/governance", label: "Governance", icon: Shield },
  { href: "/decisions", label: "Decisions", icon: Scale },
  { href: "/decision-summary", label: "Decision Summary", icon: PieChart },
  { href: "/changes", label: "Changes", icon: GitPullRequest },
  { href: "/change-calendar", label: "Change Calendar", icon: Calendar },
  { href: "/intelligence", label: "Intelligence", icon: Brain },
  { href: "/anomalies", label: "Anomalies", icon: AlertTriangle },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/modules", label: "Modules", icon: Boxes },
  { href: "/procurement", label: "Procurement", icon: FileCheck },
  { href: "/environments", label: "Environments", icon: Server },
  { href: "/architecture", label: "Architecture", icon: Landmark },
  { href: "/streaming", label: "Streaming", icon: Radio },
] as const;

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = {
  title?: string;
  items: readonly NavItem[];
};

const navSections: NavSection[] = [
  { items: navItems },
  {
    title: "Deal Engine",
    items: [
      { href: "/pipeline", label: "Pipeline", icon: TrendingUp },
      { href: "/pilots", label: "Pilots", icon: Rocket },
      { href: "/ingestion", label: "Ingestion", icon: Database },
      { href: "/follow-ups", label: "Follow-ups", icon: Bell },
      { href: "/partners", label: "Partners", icon: Handshake },
      { href: "/proposals", label: "Proposals", icon: FileText },
      { href: "/accounts", label: "Accounts", icon: Building2 },
      { href: "/proof", label: "Proof", icon: ShieldCheck },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-lg font-semibold text-foreground">
            Nzila OS
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Control Plane</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navSections.map((section, si) => (
            <div key={si}>
              {section.title && (
                <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
              )}
              {section.items.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Recommendation &amp; visibility only
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
