"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
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
  Crosshair,
  ShieldAlert,
  FolderKanban,
} from "lucide-react";

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/revenue", label: "Revenue", icon: TrendingUp },
  { href: "/command-center", label: "Command Center", icon: Crosshair },
  { href: "/governance", label: "Governance", icon: Shield },
  { href: "/governance/history", label: "Gov History", icon: ShieldAlert },
  { href: "/governance/policy-performance", label: "Policy Performance", icon: Shield },
  { href: "/governance/policy-regression", label: "Policy Regression", icon: Shield },
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
  { href: "/ops/evidence", label: "Ops Evidence", icon: Shield },
  { href: "/ops/control-center", label: "Control Center", icon: Crosshair },
  { href: "/business/metrics", label: "Business Metrics", icon: TrendingUp },
  { href: "/business/simulated-economics", label: "Simulated Economics", icon: TrendingUp },
  { href: "/releases", label: "Releases", icon: FolderKanban },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const locale = useLocale();

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
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const localizedHref = `/${locale}${href}`;
            const isActive = pathname === localizedHref;
            return (
              <Link
                key={href}
                href={localizedHref}
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
