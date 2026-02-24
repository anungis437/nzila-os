/**
 * Sidebar component for UnionEyes
 * Provides comprehensive navigation for union stakeholders with role-based access
 * Supports members, stewards, officers, and administrators
 *
 * Navigation tiers:
 *   - Nzila platform roles see super-org nav only (platform ops, org browser)
 *   - When an org is selected, org-specific sections appear
 *   - Sections are collapsible with persistent open/close state
 */
"use client";

import { 
  Home, 
  Settings, 
  FileText, 
  Users, 
  Vote, 
  BookOpen, 
  Shield, 
  BarChart3, 
  Mic,
  FileBarChart,
  Bell,
  Scale,
  Library,
  GitCompare,
  Target,
  Building2,
  Network,
  Briefcase,
  Flag,
  DollarSign,
  GraduationCap,
  MessageSquare,
  AlertTriangle,
  Handshake,
  Receipt,
  Activity,
  ChevronDown,
  Globe,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { SelectProfile } from "@/db/schema/domains/member";
import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect, useCallback } from "react";
 
 
 
import { useOrganization } from "@/contexts/organization-context";

// ── Nzila platform roles (super-org level — no union nav) ────────────────────
const NZILA_ROLES = [
  "app_owner", "coo", "cto", "platform_lead",
  "customer_success_director", "support_manager",
  "data_analytics_manager", "billing_manager",
  "support_agent", "data_analyst", "billing_specialist",
] as const;

type _NzilaRole = typeof NZILA_ROLES[number];

interface SidebarProps {
  profile: SelectProfile | null;
  userEmail?: string;
  whopMonthlyPlanId: string;
  whopYearlyPlanId: string;
  userRole?: string;
}

// ── Collapsible section sub-component ────────────────────────────────────────
function NavSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      {/* Section header — click to toggle */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full mb-1 px-3 flex items-center justify-between group cursor-pointer"
      >
        <h3 className="hidden md:block text-[10px] font-semibold text-gray-400 uppercase tracking-wider select-none group-hover:text-gray-600 transition-colors">
          {title}
        </h3>
        <ChevronDown
          size={12}
          className={`hidden md:block text-gray-400 group-hover:text-gray-600 transition-transform duration-200 ${
            open ? "" : "-rotate-90"
          }`}
        />
        {/* mobile divider */}
        <div className="md:hidden h-px w-full bg-linear-to-r from-transparent via-gray-300 to-transparent my-2" />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function Sidebar({ profile: _profile, userEmail, whopMonthlyPlanId: _whopMonthlyPlanId, whopYearlyPlanId: _whopYearlyPlanId, userRole = "member" }: SidebarProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations();
  const [isMounted, setIsMounted] = useState(false);
  const { organizationId, organization } = useOrganization();

  useEffect(() => { setIsMounted(true); }, []);

  const isActive = (path: string) => pathname === path;
  const isNzila = (NZILA_ROLES as readonly string[]).includes(userRole);
  const hasSelectedOrg = !!organizationId;

  // ── Helper: build role arrays quickly ──────────────────────────────────────
  const unionAll = ["member", "steward", "chief_steward", "officer", "president", "vice_president", "secretary_treasurer", "bargaining_committee", "health_safety_rep", "national_officer", "admin"];
  const repsAndAbove = ["steward", "chief_steward", "officer", "president", "vice_president", "secretary_treasurer", "bargaining_committee", "national_officer", "admin"];
  const leadershipRoles = ["officer", "president", "vice_president", "secretary_treasurer", "national_officer", "admin"];
  const execRoles = ["president", "vice_president", "secretary_treasurer", "national_officer"];
  const clcRoles = ["congress_staff", "federation_staff", "clc_staff", "clc_executive", "fed_staff", "fed_executive", "system_admin", "national_officer", "admin"];
  const nzilaAll = [...NZILA_ROLES];

  // ── Super-org sections (Nzila platform level) ─────────────────────────────
  const superOrgSections = [
    {
      title: 'Nzila Platform',
      roles: nzilaAll,
      items: [
        { href: `/${locale}/dashboard`, icon: <Home size={16} />, label: 'Platform Home', roles: nzilaAll },
        { href: `/${locale}/dashboard/operations`, icon: <Activity size={16} />, label: 'Operations', roles: ["app_owner", "coo", "cto", "platform_lead"] },
        { href: `/${locale}/dashboard/customer-success`, icon: <Users size={16} />, label: 'Customer Success', roles: ["app_owner", "coo", "customer_success_director"] },
        { href: `/${locale}/dashboard/support`, icon: <AlertTriangle size={16} />, label: 'Support Center', roles: ["app_owner", "coo", "support_manager", "support_agent"] },
        { href: `/${locale}/dashboard/analytics-admin`, icon: <BarChart3 size={16} />, label: 'Platform Analytics', roles: ["app_owner", "coo", "cto", "data_analytics_manager", "data_analyst"] },
        { href: `/${locale}/dashboard/billing-admin`, icon: <DollarSign size={16} />, label: 'Billing & Subscriptions', roles: ["app_owner", "coo", "billing_manager", "billing_specialist"] },
      ],
    },
    {
      title: 'Organizations',
      roles: nzilaAll,
      items: [
        { href: `/${locale}/dashboard/admin/organizations`, icon: <Globe size={16} />, label: 'Browse Organizations', roles: nzilaAll },
        { href: `/${locale}/dashboard/compliance`, icon: <FileBarChart size={16} />, label: 'Compliance Reports', roles: ["app_owner", "coo", "cto", "platform_lead"] },
        { href: `/${locale}/dashboard/sector-analytics`, icon: <BarChart3 size={16} />, label: 'Sector Analytics', roles: ["app_owner", "coo", "cto", "data_analytics_manager", "data_analyst"] },
      ],
    },
  ];

  // ── Org-specific sections (appear when an org is selected for Nzila users,
  //    or always for org-member roles) ───────────────────────────────────────
  const orgSections = [
    {
      title: organization?.name ? `${organization.name}` : t('sidebar.yourUnion'),
      roles: unionAll,
      items: [
        { href: `/${locale}/dashboard`, icon: <Home size={16} />, label: t('navigation.dashboard'), roles: unionAll },
        { href: `/${locale}/dashboard/claims`, icon: <FileText size={16} />, label: t('claims.myCases'), roles: unionAll },
        { href: `/${locale}/dashboard/claims/new`, icon: <Mic size={16} />, label: t('claims.submitNew'), roles: unionAll },
        { href: `/${locale}/dashboard/health-safety`, icon: <Shield size={16} />, label: 'Health & Safety', roles: unionAll },
        { href: `/${locale}/dashboard/pension`, icon: <Briefcase size={16} />, label: 'My Pension & Benefits', roles: unionAll },
        { href: `/${locale}/dashboard/dues`, icon: <DollarSign size={16} />, label: 'Dues & Payments', roles: unionAll },
      ],
    },
    {
      title: t('sidebar.participation'),
      roles: ["member", "steward", "officer", "admin"],
      items: [
        { href: `/${locale}/dashboard/education`, icon: <GraduationCap size={16} />, label: 'Education & Training', roles: ["member", "steward", "officer", "admin"] },
        { href: `/${locale}/dashboard/voting`, icon: <Vote size={16} />, label: t('navigation.vote'), roles: ["member", "steward", "officer", "admin"] },
        { href: `/${locale}/dashboard/agreements`, icon: <BookOpen size={16} />, label: t('sidebar.ourAgreements'), roles: ["member", "steward", "officer", "admin"] },
      ],
    },
    {
      title: t('sidebar.representativeTools'),
      roles: repsAndAbove,
      items: [
        { href: `/${locale}/dashboard/workbench`, icon: <FileBarChart size={16} />, label: t('claims.caseQueue'), roles: repsAndAbove },
        { href: `/${locale}/dashboard/members`, icon: <Users size={16} />, label: t('members.directory'), roles: repsAndAbove },
        { href: `/${locale}/dashboard/clause-library`, icon: <Library size={16} />, label: t('sidebar.clauseLibrary'), roles: repsAndAbove },
        { href: `/${locale}/dashboard/analytics`, icon: <BarChart3 size={16} />, label: t('sidebar.insights'), roles: repsAndAbove },
        { href: `/${locale}/dashboard/precedents`, icon: <Scale size={16} />, label: 'Precedents', roles: repsAndAbove },
        { href: `/${locale}/dashboard/stewards`, icon: <Users size={16} />, label: 'Steward Management', roles: ["chief_steward", "officer", "president", "vice_president", "national_officer", "admin"] },
        { href: `/${locale}/dashboard/cross-union-analytics`, icon: <GitCompare size={16} />, label: 'Cross-Union Analytics', roles: ["officer", "president", "vice_president", "secretary_treasurer", "national_officer", "admin"] },
      ],
    },
    {
      title: 'Specialized Committees',
      roles: ["bargaining_committee", "health_safety_rep"],
      items: [
        { href: `/${locale}/dashboard/bargaining`, icon: <Handshake size={16} />, label: 'Bargaining Dashboard', roles: ["bargaining_committee"] },
        { href: `/${locale}/dashboard/health-safety`, icon: <Shield size={16} />, label: 'H&S Dashboard', roles: ["health_safety_rep"] },
      ],
    },
    {
      title: t('sidebar.leadership'),
      roles: leadershipRoles,
      items: [
        { href: `/${locale}/dashboard/communications`, icon: <MessageSquare size={16} />, label: 'Communications', roles: leadershipRoles },
        { href: `/${locale}/dashboard/grievances`, icon: <Scale size={16} />, label: t('grievance.title'), roles: leadershipRoles },
        { href: `/${locale}/dashboard/bargaining`, icon: <Handshake size={16} />, label: 'Bargaining & Negotiations', roles: [...leadershipRoles, "bargaining_committee"] },
        { href: `/${locale}/dashboard/financial`, icon: <Receipt size={16} />, label: 'Financial Management', roles: leadershipRoles },
        { href: `/${locale}/dashboard/targets`, icon: <Target size={16} />, label: 'Performance Targets', roles: ["officer", "president", "vice_president", "national_officer", "admin"] },
        { href: `/${locale}/dashboard/organizing`, icon: <Flag size={16} />, label: 'Organizing Campaigns', roles: ["officer", "president", "vice_president", "national_officer", "admin"] },
        { href: `/${locale}/dashboard/strike-fund`, icon: <DollarSign size={16} />, label: 'Strike Fund', roles: leadershipRoles },
        { href: `/${locale}/dashboard/notifications`, icon: <Bell size={16} />, label: t('sidebar.alerts'), roles: leadershipRoles },
        { href: `/${locale}/dashboard/pension/admin`, icon: <Briefcase size={16} />, label: 'Pension Administration', roles: ["officer", "president", "secretary_treasurer", "national_officer", "admin"] },
        { href: `/${locale}/dashboard/pension/trustee`, icon: <Shield size={16} />, label: 'Trustee Portal', roles: ["officer", "president", "secretary_treasurer", "national_officer", "admin"] },
      ],
    },
    {
      title: 'Executive Leadership',
      roles: execRoles,
      items: [
        { href: `/${locale}/dashboard/executive`, icon: <Building2 size={16} />, label: 'Executive Dashboard', roles: execRoles },
        { href: `/${locale}/dashboard/governance`, icon: <FileText size={16} />, label: 'Governance', roles: execRoles },
        { href: `/${locale}/dashboard/audits`, icon: <FileBarChart size={16} />, label: 'Audits & Compliance', roles: [...execRoles, "admin"] },
      ],
    },
  ];

  // ── Federation / CLC sections ──────────────────────────────────────────────
  const fedSections = [
    {
      title: 'Federation & CLC Services',
      roles: clcRoles,
      items: [
        { href: `/${locale}/dashboard/cross-union-analytics`, icon: <GitCompare size={16} />, label: 'Cross-Union Analytics', roles: clcRoles },
        { href: `/${locale}/dashboard/precedents`, icon: <Scale size={16} />, label: 'Precedent Database', roles: clcRoles },
        { href: `/${locale}/dashboard/clause-library`, icon: <Library size={16} />, label: 'Shared Clause Library', roles: clcRoles },
        { href: `/${locale}/dashboard/admin/organizations`, icon: <Building2 size={16} />, label: 'Affiliate Management', roles: clcRoles },
        { href: `/${locale}/dashboard/compliance`, icon: <FileBarChart size={16} />, label: 'Compliance Reports', roles: ["congress_staff", "federation_staff", "clc_staff", "clc_executive", "system_admin", "admin"] },
        { href: `/${locale}/dashboard/sector-analytics`, icon: <BarChart3 size={16} />, label: 'Sector Analytics', roles: ["congress_staff", "clc_staff", "clc_executive", "system_admin", "admin"] },
      ],
    },
    {
      title: 'CLC National Operations',
      roles: ["clc_staff", "clc_executive", "system_admin", "admin"],
      items: [
        { href: `/${locale}/dashboard/clc`, icon: <Building2 size={16} />, label: 'CLC Dashboard', roles: ["clc_staff", "clc_executive", "system_admin", "admin"] },
        { href: `/${locale}/dashboard/clc/affiliates`, icon: <Network size={16} />, label: 'Affiliates Management', roles: ["clc_staff", "clc_executive", "system_admin", "admin"] },
        { href: `/${locale}/dashboard/clc/staff`, icon: <Users size={16} />, label: 'CLC Staff Operations', roles: ["clc_staff", "clc_executive", "system_admin", "admin"] },
        { href: `/${locale}/dashboard/clc/compliance`, icon: <FileBarChart size={16} />, label: 'CLC Compliance', roles: ["clc_staff", "clc_executive", "system_admin", "admin"] },
      ],
    },
    {
      title: 'Provincial Federation',
      roles: ["fed_staff", "fed_executive", "system_admin", "admin"],
      items: [
        { href: `/${locale}/dashboard/federation`, icon: <Network size={16} />, label: 'Federation Dashboard', roles: ["fed_staff", "fed_executive", "system_admin", "admin"] },
        { href: `/${locale}/dashboard/federation/affiliates`, icon: <Building2 size={16} />, label: 'Affiliate Unions', roles: ["fed_staff", "fed_executive", "system_admin", "admin"] },
        { href: `/${locale}/dashboard/federation/remittances`, icon: <DollarSign size={16} />, label: 'Remittance Tracking', roles: ["fed_staff", "fed_executive", "system_admin", "admin"] },
      ],
    },
  ];

  // ── System section (always at end) ─────────────────────────────────────────
  const systemSection = [
    {
      title: t('sidebar.system'),
      roles: ["admin", "system_admin", ...nzilaAll],
      items: [
        { href: `/${locale}/dashboard/admin`, icon: <Shield size={16} />, label: t('navigation.adminPanel'), roles: ["admin", "system_admin", "app_owner", "coo", "cto"] },
        { href: `/${locale}/dashboard/settings`, icon: <Settings size={16} />, label: t('sidebar.preferences'), roles: [...unionAll, "system_admin", "congress_staff", "federation_staff", "clc_staff", "clc_executive", "fed_staff", "fed_executive", ...nzilaAll] },
      ],
    },
  ];

  // ── Section shape (broad enough for all tiers) ──────────────────────────────
  type SidebarSection = {
    title: string;
    roles: string[];
    items: { href: string; icon: React.ReactNode; label: string; roles: string[] }[];
  };

  // ── Assemble final navigation list based on role tier ──────────────────────
  const buildSections = useCallback(() => {
    let sections: SidebarSection[] = [];

    if (isNzila) {
      // Nzila platform users: always show super-org nav
      sections = [...superOrgSections];

      // When an org is selected, also show org-level sections so they can drill in
      if (hasSelectedOrg) {
        sections = [...sections, ...orgSections];
      }
    } else {
      // Union / federation / CLC roles: show org sections + fed sections
      sections = [...orgSections, ...fedSections];
    }

    // Always append system section
    sections = [...sections, ...systemSection];

    // Filter by role
    return sections
      .map(section => ({
        ...section,
        items: section.items.filter(item => item.roles.includes(userRole)),
      }))
      .filter(section => section.items.length > 0 && section.roles.includes(userRole));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, isNzila, hasSelectedOrg, locale, organization]);

  const visibleSections = buildSections();

  // ── Render nav item ────────────────────────────────────────────────────────
  const renderItem = (item: { href: string; icon: React.ReactNode; label: string }) => (
    <Link key={item.href} href={item.href} className="block">
      <motion.div
        className={`flex items-center py-2 px-3 rounded-lg cursor-pointer transition-all ${
          isActive(item.href)
            ? "bg-linear-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30"
            : "text-gray-600 hover:bg-white/80 hover:shadow-sm"
        }`}
        whileHover={{ scale: 1.02, x: 2, transition: { duration: 0.2 } }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-center">{item.icon}</div>
        <span className="ml-3 hidden md:block text-sm font-medium">{item.label}</span>
      </motion.div>
    </Link>
  );

  return (
    <div className="h-screen w-15 md:w-55 bg-white/60 backdrop-blur-xl border-r border-white/40 flex flex-col justify-between py-5 relative overflow-hidden">
      {/* Glassmorphism effects */}
      <motion.div
        className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-primary/5 pointer-events-none"
        animate={{
          opacity: [0.4, 0.6, 0.4],
          background: [
            "linear-gradient(to bottom, rgba(var(--primary), 0.03), transparent, rgba(var(--primary), 0.03))",
            "linear-gradient(to bottom, rgba(var(--primary), 0.05), transparent, rgba(var(--primary), 0.05))",
            "linear-gradient(to bottom, rgba(var(--primary), 0.03), transparent, rgba(var(--primary), 0.03))",
          ],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Enhanced edge highlights for 3D effect */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-gray-300/50 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-px bg-linear-to-b from-transparent via-white to-transparent opacity-80" />
      <div className="absolute inset-y-0 right-0 w-px bg-linear-to-b from-transparent via-white to-transparent opacity-80" />

      {/* Logo */}
      <div className="px-3 mb-6 relative z-10">
        <Link href={`/${locale}/dashboard`}>
          <motion.div
            className="flex items-center justify-center md:justify-start gap-2"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-blue-600 to-blue-800 shadow-lg">
              <Shield size={18} className="text-white" />
            </div>
            <div className="hidden md:block">
              <span className="font-bold text-lg bg-linear-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                UnionEyes
              </span>
            </div>
          </motion.div>
        </Link>
      </div>

      {/* Org badge — shown when Nzila user has selected an org */}
      {isNzila && hasSelectedOrg && organization && (
        <div className="px-3 mb-3 relative z-10">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700">
            <Building2 size={12} />
            <span className="text-[11px] font-medium truncate">{organization.name}</span>
          </div>
        </div>
      )}

      {/* Navigation Sections — transparent scrollbar */}
      <nav className="flex-1 px-3 relative z-10 overflow-y-auto sidebar-scroll">
        <div className="space-y-4">
          {visibleSections.map((section) => (
            <NavSection key={section.title} title={section.title} defaultOpen>
              {section.items.map(renderItem)}
            </NavSection>
          ))}
        </div>
      </nav>

      {/* Bottom Section - User Profile */}
      <div className="mt-auto pt-4 relative z-10">
        <div className="h-px bg-linear-to-r from-transparent via-gray-200 to-transparent mb-3" />

        <Link href="/dashboard/profile">
          <motion.div
            className="flex items-center px-3 py-3 hover:bg-white/70 rounded-lg mx-2 cursor-pointer transition-colors"
            whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/80 flex items-center justify-center bg-white/80 shadow-sm">
              {isMounted ? (
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "w-8 h-8",
                      userButtonTrigger: "w-8 h-8 rounded-full",
                    },
                  }}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
              )}
            </div>
            <div className="hidden md:block ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {userEmail?.split("@")[0] || t("common.member")}
              </p>
              <p className="text-xs text-gray-500">{t("sidebar.viewProfile")}</p>
            </div>
          </motion.div>
        </Link>
      </div>

    </div>
  );
}
