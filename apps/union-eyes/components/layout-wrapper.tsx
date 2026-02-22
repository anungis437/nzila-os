"use client";

/**
 * Layout Wrapper component for Union Eyes
 * Controls when to show the header based on the current URL path.
 * Marketing pages use their own SiteNavigation via (marketing)/layout.tsx,
 * and auth pages (sign-in/sign-up) use AuthPageLayout.
 */
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/header";

interface LayoutWrapperProps {
  children: ReactNode;
}

/** Routes that provide their own navigation / layout */
const HIDE_HEADER_PATTERNS = [
  "/dashboard",
  "/portal",
  "/sign-in",
  "/sign-up",
  "/pilot-request",
  "/story",
  "/case-studies",
  "/contact",
  "/pricing",
  "/status",
];

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();

  const shouldHideHeader =
    HIDE_HEADER_PATTERNS.some((p) => pathname?.includes(p)) ||
    pathname === "/" ||
    pathname === "";

  return (
    <>
      {!shouldHideHeader && <Header />}
      <main>{children}</main>
    </>
  );
}
