/**
 * Member Portal Layout
 * Layout for member self-service portal pages
 */
import { ReactNode } from "react";
import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from "next/navigation";
import Link from "next/link";
import LanguageSwitcher from "@/components/language-switcher";
import { 
  Home, 
  User, 
  FileText, 
  FolderOpen, 
  DollarSign,
  MessageSquare,
  Bell,
  Settings
} from "lucide-react";

export default async function PortalLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect(`/${locale}/sign-in`);
  }

  const navItems = [
    { href: `/${locale}/portal`, label: "Dashboard", icon: Home },
    { href: `/${locale}/portal/profile`, label: "My Profile", icon: User },
    { href: `/${locale}/portal/claims`, label: "My Cases", icon: FileText },
    { href: `/${locale}/portal/documents`, label: "Documents", icon: FolderOpen },
    { href: `/${locale}/portal/dues`, label: "Dues & Payments", icon: DollarSign },
    { href: `/${locale}/portal/messages`, label: "Messages", icon: MessageSquare },
    { href: `/${locale}/portal/notifications`, label: "Notifications", icon: Bell },
    { href: `/${locale}/portal/settings`, label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Portal Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Member Portal</h1>
              <p className="text-sm text-gray-600">Your union membership dashboard</p>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <Link
                href={`/${locale}/dashboard`}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Back to Admin Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar Navigation */}
          <aside className="col-span-3">
            <nav className="bg-white rounded-lg shadow p-4 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
            </nav>
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
