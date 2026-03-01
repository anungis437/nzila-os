/**
 * Admin Layout
 * 
 * Provides consistent navigation and layout for all admin pages.
 * Enforces admin-only access with role checking.
 */

import { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/rbac-server";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Shield,
  Bell,
  Settings,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect(`/${locale}/sign-in`);
  }

  // RBAC check — only admins can access admin layout
  try {
    await requireAdmin();
  } catch {
    redirect(`/${locale}/dashboard`);
  }

  const navItems = [
    { 
      href: `/${locale}/admin`, 
      label: "Dashboard", 
      icon: LayoutDashboard,
      description: "System overview" 
    },
    { 
      href: `/${locale}/admin/orgs`, 
      label: "Organizations", 
      icon: Building2,
      description: "Manage organizations" 
    },
    { 
      href: `/${locale}/admin/users`, 
      label: "Users", 
      icon: Users,
      description: "User & role management" 
    },
    { 
      href: `/${locale}/admin/permissions`, 
      label: "Permissions", 
      icon: Shield,
      description: "Permission audit" 
    },
    { 
      href: `/${locale}/admin/alerts`, 
      label: "Alerts", 
      icon: Bell,
      description: "Alert rules and incidents" 
    },
    { 
      href: `/${locale}/admin/audit`, 
      label: "Audit Logs", 
      icon: Activity,
      description: "System activity logs" 
    },
    { 
      href: `/${locale}/dashboard/settings`, 
      label: "Settings", 
      icon: Settings,
      description: "System configuration" 
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
                <p className="text-sm text-gray-600">System Administration</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link href={`/${locale}/dashboard`}>
                <Button variant="outline" size="sm">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar Navigation */}
          <aside className="col-span-3">
            <nav className="bg-white rounded-lg shadow-sm border p-4 space-y-1 sticky top-24">
              <div className="pb-3 mb-3 border-b">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Navigation
                </p>
              </div>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-start gap-3 px-3 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors group"
                  >
                    <Icon className="h-5 w-5 mt-0.5 shrink-0 group-hover:text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs text-gray-500 group-hover:text-blue-600 truncate">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* Quick Stats Card */}
            <div className="mt-4 bg-linear-to-br from-blue-600 to-blue-700 rounded-lg shadow-sm border p-4 text-white">
              <h3 className="text-sm font-semibold mb-2">Admin Access</h3>
              <p className="text-xs opacity-90">
                You have full system access. All actions are logged for audit.
              </p>
            </div>
          </aside>

          {/* Main Content */}
          <main className="col-span-9">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
