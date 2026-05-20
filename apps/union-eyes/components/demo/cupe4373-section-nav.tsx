"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  LayoutDashboard,
  Scale,
} from "lucide-react";

const sections = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Cases",
    href: "/dashboard/cases",
    icon: BriefcaseBusiness,
  },
  {
    label: "Grievances",
    href: "/dashboard/grievances",
    icon: Scale,
  },
  {
    label: "Agreements",
    href: "/dashboard/agreements",
    icon: BookOpen,
  },
  {
    label: "Calendar",
    href: "/dashboard/calendar",
    icon: CalendarDays,
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
  },
];

export function Cupe4373SectionNav() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav
      aria-label="CUPE4373 demo sections"
      className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
    >
      <div className="flex min-w-max items-center gap-1">
        {sections.map((section) => {
          const Icon = section.icon;
          const href = `/${locale}${section.href}`;
          const active =
            pathname === href ||
            (section.href !== "/dashboard" && pathname.startsWith(`${href}/`));

          return (
            <Link
              key={section.href}
              href={href}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {section.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
