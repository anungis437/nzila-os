/**
 * Dashboard Topbar Component for UnionEyes
 * Union Claims Management System
 * Provides breadcrumb navigation, search, notifications, and user menu
 */
"use client";

import { Bell, Search, Menu, Shield, ChevronRight } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { SelectProfile } from "@/db/schema/domains/member";

interface DashboardTopbarProps {
  profile: SelectProfile | null;
  onMenuClick?: () => void;
}

export default function DashboardTopbar({ profile, onMenuClick }: DashboardTopbarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const [notificationCount, setNotificationCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  // Load user role from organizationMembers table
  useEffect(() => {
    if (!profile?.userId) return;

    const loadUserRoles = async () => {
      try {
        const response = await fetch('/api/profile/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: profile.userId }),
        });

        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.role === 'admin' || data.roles?.includes('admin'));
        }
      } catch (_error) {
setIsAdmin(false);
      }
    };

    loadUserRoles();

    // Load actual notification count from API
    const loadNotifications = async () => {
      try {
        const response = await fetch('/api/notifications/count', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          setNotificationCount(data.count || 0);
        }
      } catch (_error) {
setNotificationCount(0);
      }
    };

    loadNotifications();
  }, [profile?.userId]);

  // Generate breadcrumbs from pathname
  const generateBreadcrumbs = () => {
    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Home', href: '/dashboard' }];
    
    let currentPath = '';
    paths.forEach((path, index) => {
      if (path === 'dashboard' && index === 0) return; // Skip dashboard root
      
      currentPath += `/${path}`;
      const label = path
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      breadcrumbs.push({
        label,
        href: currentPath.startsWith('/dashboard') ? currentPath : `/dashboard${currentPath}`
      });
    });
    
    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm"
    >
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left Section: Menu Button + Breadcrumbs */}
        <div className="flex items-center space-x-4 flex-1">
          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={onMenuClick}
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center space-x-2">
                {index > 0 && (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-semibold text-gray-900">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Center Section: Search (Desktop) */}
        <div className="hidden lg:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Search claims, members..."
              className="pl-10 bg-white/50 border-gray-200 border focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Right Section: Actions + User */}
        <div className="flex items-center space-x-3 flex-1 justify-end">
          {/* Admin Badge */}
          {isAdmin && (
            <Link href="/admin">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Badge
                  variant="outline"
                  className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 cursor-pointer"
                >
                  <Shield className="w-3 h-3 mr-1" />
                  Admin Panel
                </Badge>
              </motion.div>
            </Link>
          )}

          {/* Notifications */}
          <Button
            variant="ghost"
            size="sm"
            className="relative"
          >
            <Bell className="w-5 h-5" />
            {notificationCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold"
              >
                {notificationCount}
              </motion.span>
            )}
          </Button>

          {/* User Menu */}
          <div className="flex items-center space-x-3">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-gray-900">
                {profile?.email || user?.primaryEmailAddress?.emailAddress || 'User'}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user?.publicMetadata?.role ? String(user.publicMetadata.role).replace('_', ' ') : 'Member'}
              </p>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="lg:hidden px-6 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Search claims, members..."
            className="pl-10 bg-white/50 border-gray-200 border focus:bg-white transition-colors"
          />
        </div>
      </div>
    </motion.div>
  );
}

