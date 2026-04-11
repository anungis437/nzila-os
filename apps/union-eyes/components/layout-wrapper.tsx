"use client";

/**
 * Layout Wrapper component for UnionEyes
 * Controls when to show the header based on the current URL path.
 * Marketing pages use their own SiteNavigation via (marketing)/layout.tsx,
 * dashboard pages use Sidebar via dashboard/layout.tsx, and auth pages use
 * AuthPageLayout. The legacy Header is no longer rendered — all app pages
 * live inside the dashboard layout now.
 */
import { ReactNode } from "react";

interface LayoutWrapperProps {
  children: ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  return <main>{children}</main>;
}
