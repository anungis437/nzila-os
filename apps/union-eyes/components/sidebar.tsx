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

import Image from "next/image";

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
  Calendar,
  DollarSign,
  GraduationCap,
  MessageSquare,
  Mail,
  AlertTriangle,
  Handshake,
  Receipt,
  Activity,
  ChevronDown,
  Globe,
  Clock,
  Database,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import type { SelectProfile } from "@/db/schema/domains/member";
import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect, useCallback } from "react";
 
 
 
import { useOrganization } from "@/contexts/organization-context";

// ── Nzila platform roles (super-org level — no union nav) ────────────────────
const NZILA_ROLES = [
  // Strategic leadership
  "app_owner", "coo", "cto",
  // Operational leadership
  "platform_lead", "customer_success_director",
  // Department managers
  "support_manager", "data_analytics_manager", "billing_manager",
  "integration_manager", "compliance_manager", "security_manager",
  // Operations staff
  "support_agent", "data_analyst", "billing_specialist",
  "integration_specialist",
  // Content & training
  "content_manager", "training_coordinator",
  // System admin
  "system_admin",
] as const;

type _NzilaRole = typeof NZILA_ROLES[number];

interface SidebarProps {
  profile: SelectProfile | null;
  userEmail?: string;
  whopMonthlyPlanId: string;
  whopYearlyPlanId: string;
  userRole?: string;
  platformOrgId?: string;
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
        <h3 className="hidden md:block text-[10px] font-semibold text-gray-500 uppercase tracking-wider select-none group-hover:text-gray-700 transition-colors">
          {title}
        </h3>
        <ChevronDown
          size={12}
          className={`hidden md:block text-gray-500 group-hover:text-gray-700 transition-transform duration-200 ${
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
export default function Sidebar({ profile: _profile, userEmail, whopMonthlyPlanId: _whopMonthlyPlanId, whopYearlyPlanId: _whopYearlyPlanId, userRole = "member", platformOrgId }: SidebarProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations();
  const [isMounted, setIsMounted] = useState(false);
  const { organizationId, organization } = useOrganization();

  useEffect(() => { setIsMounted(true); }, []);

  const isActive = (path: string) => pathname === path;
  const isNzila = (NZILA_ROLES as readonly string[]).includes(userRole);
  const hasSelectedOrg = !!organizationId;
  // Platform admin viewing a tenant org should see that tenant's navigation
  const isViewingPlatformOrg = !organizationId || organizationId === platformOrgId;
  const isViewingTenantOrg = isNzila && hasSelectedOrg && !isViewingPlatformOrg;

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
      title: t('sidebar.nzilaPlatform'),
      roles: nzilaAll,
      items: [
        { href: `/${locale}/dashboard`, icon: <Home size={16} />, label: t('sidebar.platformHome'), roles: nzilaAll },
        { href: `/${locale}/dashboard/operations`, icon: <Activity size={16} />, label: t('sidebar.operations'), roles: ["app_owner", "coo", "cto", "platform_lead"] },
        { href: `/${locale}/dashboard/customer-success`, icon: <Users size={16} />, label: t('sidebar.customerSuccess'), roles: ["app_owner", "coo", "customer_success_director"] },
        { href: `/${locale}/dashboard/support`, icon: <AlertTriangle size={16} />, label: t('sidebar.supportCenter'), roles: ["app_owner", "coo", "support_manager", "support_agent"] },
        { href: `/${locale}/dashboard/analytics-admin`, icon: <BarChart3 size={16} />, label: t('sidebar.platformAnalytics'), roles: ["app_owner", "coo", "cto", "data_analytics_manager", "data_analyst"] },
        { href: `/${locale}/dashboard/billing-admin`, icon: <DollarSign size={16} />, label: t('sidebar.billingSubscriptions'), roles: ["app_owner", "coo", "billing_manager", "billing_specialist"] },
        { href: `/${locale}/dashboard/integrations`, icon: <Network size={16} />, label: t('sidebar.integrationsAPIs'), roles: ["app_owner", "coo", "cto", "integration_manager", "integration_specialist"] },
        { href: `/${locale}/dashboard/security`, icon: <Shield size={16} />, label: t('sidebar.securityCompliance'), roles: ["app_owner", "coo", "cto", "compliance_manager", "security_manager"] },
        { href: `/${locale}/dashboard/content`, icon: <BookOpen size={16} />, label: t('sidebar.contentTraining'), roles: ["app_owner", "coo", "content_manager", "training_coordinator"] },
      ],
    },
    {
      title: t('sidebar.administration'),
      roles: nzilaAll,
      items: [
        { href: `/${locale}/dashboard/admin/organizations`, icon: <Globe size={16} />, label: t('sidebar.browseOrganizations'), roles: nzilaAll },
        { href: `/${locale}/dashboard/admin/governance`, icon: <FileText size={16} />, label: t('sidebar.governanceDashboard'), roles: ["app_owner", "coo", "platform_lead"] },
        { href: `/${locale}/dashboard/admin/members`, icon: <Users size={16} />, label: t('sidebar.memberManagement'), roles: ["app_owner", "coo", "platform_lead", "support_manager"] },
        { href: `/${locale}/dashboard/admin/rewards`, icon: <DollarSign size={16} />, label: t('sidebar.rewardsAdministration'), roles: ["app_owner", "coo", "customer_success_director"] },
        { href: `/${locale}/dashboard/admin/scheduled-reports`, icon: <Bell size={16} />, label: t('sidebar.scheduledReports'), roles: ["app_owner", "coo", "cto", "data_analytics_manager"] },
        { href: `/${locale}/dashboard/compliance-admin`, icon: <FileBarChart size={16} />, label: t('sidebar.complianceAudit'), roles: ["app_owner", "coo", "cto", "compliance_manager", "security_manager"] },
        { href: `/${locale}/dashboard/compliance`, icon: <FileBarChart size={16} />, label: t('sidebar.complianceReports'), roles: ["app_owner", "coo", "cto", "platform_lead"] },
        { href: `/${locale}/dashboard/sector-analytics`, icon: <BarChart3 size={16} />, label: t('sidebar.sectorAnalytics'), roles: ["app_owner", "coo", "cto", "data_analytics_manager", "data_analyst"] },
        { href: `/${locale}/dashboard/data-source`, icon: <Network size={16} />, label: t('sidebar.dataSources'), roles: ["app_owner", "cto", "integration_manager", "data_analytics_manager"] },
        { href: `/${locale}/dashboard/pilot`, icon: <Activity size={16} />, label: t('sidebar.pilotDashboard'), roles: ["app_owner", "coo", "platform_lead", "customer_success_director"] },
      ],
    },
  ];

  // ── Org-specific sections (appear when an org is selected for Nzila users,
  //    or always for org-member roles) ───────────────────────────────────────
  //
  // "platform_viewer" is a virtual role used when platform/CLC management
  // views a tenant org.  It grants visibility to oversight & leadership items
  // but NOT to personal member features (My Cases, Pension, Dues, Voting…).
  const mgmt = "platform_viewer";

  const orgSections = [
    {
      title: organization?.name ? `${organization.name}` : t('sidebar.yourUnion'),
      roles: [...unionAll, mgmt],
      items: [
        { href: `/${locale}/dashboard`, icon: <Home size={16} />, label: t('navigation.dashboard'), roles: [...unionAll, mgmt] },
        { href: `/${locale}/dashboard/claims`, icon: <FileText size={16} />, label: t('claims.myCases'), roles: unionAll },
        { href: `/${locale}/dashboard/claims/new`, icon: <Mic size={16} />, label: t('claims.submitNew'), roles: unionAll },
        { href: `/${locale}/dashboard/pension`, icon: <Briefcase size={16} />, label: t('sidebar.pensionBenefits'), roles: unionAll },
        { href: `/${locale}/dashboard/dues`, icon: <DollarSign size={16} />, label: t('sidebar.duesDeductions'), roles: unionAll },
        { href: `/${locale}/dashboard/messages`, icon: <Mail size={16} />, label: t('sidebar.messages'), roles: unionAll },
      ],
    },
    {
      title: t('sidebar.participation'),
      roles: ["member", "steward", "officer", "admin"],
      items: [
        { href: `/${locale}/dashboard/education`, icon: <GraduationCap size={16} />, label: t('sidebar.educationTraining'), roles: ["member", "steward", "officer", "admin"] },
        { href: `/${locale}/dashboard/voting`, icon: <Vote size={16} />, label: t('navigation.vote'), roles: ["member", "steward", "officer", "admin"] },
        { href: `/${locale}/dashboard/agreements`, icon: <BookOpen size={16} />, label: t('sidebar.ourAgreements'), roles: ["member", "steward", "officer", "admin", mgmt] },
        { href: `/${locale}/dashboard/calendar`, icon: <Calendar size={16} />, label: t('calendar.title'), roles: ["member", "steward", "officer", "admin", mgmt] },
        { href: `/${locale}/dashboard/ai-assistant`, icon: <MessageSquare size={16} />, label: t('sidebar.aiAssistant'), roles: ["member", "steward", "officer", "admin"] },
      ],
    },
    {
      title: t('sidebar.representativeTools'),
      roles: [...repsAndAbove, mgmt],
      items: [
        { href: `/${locale}/dashboard/workbench`, icon: <FileBarChart size={16} />, label: t('claims.caseQueue'), roles: [...repsAndAbove, mgmt] },
        { href: `/${locale}/dashboard/deadlines`, icon: <Clock size={16} />, label: t('sidebar.deadlines'), roles: [...repsAndAbove, mgmt] },
        { href: `/${locale}/dashboard/members`, icon: <Users size={16} />, label: t('members.directory'), roles: [...repsAndAbove, mgmt] },
        { href: `/${locale}/dashboard/clause-library`, icon: <Library size={16} />, label: t('sidebar.clauseLibrary'), roles: [...repsAndAbove, mgmt] },
        { href: `/${locale}/cba-intelligence`, icon: <Database size={16} />, label: t('sidebar.cbaIntelligence'), roles: [...repsAndAbove, mgmt] },
        { href: `/${locale}/dashboard/precedents`, icon: <Scale size={16} />, label: t('sidebar.precedents'), roles: [...repsAndAbove, mgmt] },
        { href: `/${locale}/dashboard/health-safety`, icon: <Shield size={16} />, label: t('sidebar.healthSafety'), roles: [...repsAndAbove, "health_safety_rep", mgmt] },
        { href: `/${locale}/dashboard/analytics`, icon: <BarChart3 size={16} />, label: t('sidebar.insights'), roles: [...repsAndAbove, mgmt] },
        { href: `/${locale}/dashboard/stewards`, icon: <Users size={16} />, label: t('sidebar.stewardManagement'), roles: ["chief_steward", "officer", "president", "vice_president", "national_officer", "admin", mgmt] },
        { href: `/${locale}/dashboard/cross-union-analytics`, icon: <GitCompare size={16} />, label: t('sidebar.crossUnionAnalytics'), roles: ["officer", "president", "vice_president", "secretary_treasurer", "national_officer", "admin", mgmt] },
      ],
    },
    {
      title: t('sidebar.specializedCommittees'),
      roles: ["bargaining_committee", "health_safety_rep"],
      items: [
        { href: `/${locale}/dashboard/bargaining`, icon: <Handshake size={16} />, label: t('sidebar.bargainingDashboard'), roles: ["bargaining_committee"] },
        { href: `/${locale}/dashboard/health-safety`, icon: <Shield size={16} />, label: t('sidebar.hsDashboard'), roles: ["health_safety_rep"] },
      ],
    },
    {
      title: t('sidebar.leadership'),
      roles: [...leadershipRoles, mgmt],
      items: [
        { href: `/${locale}/dashboard/communications`, icon: <MessageSquare size={16} />, label: t('sidebar.communications'), roles: [...leadershipRoles, mgmt] },
        { href: `/${locale}/dashboard/grievances`, icon: <Scale size={16} />, label: t('grievance.title'), roles: [...leadershipRoles, mgmt] },
        { href: `/${locale}/dashboard/bargaining`, icon: <Handshake size={16} />, label: t('sidebar.bargainingNegotiations'), roles: [...leadershipRoles, "bargaining_committee", mgmt] },
        { href: `/${locale}/dashboard/financial`, icon: <Receipt size={16} />, label: t('sidebar.financialManagement'), roles: [...leadershipRoles, mgmt] },
        { href: `/${locale}/dashboard/targets`, icon: <Target size={16} />, label: t('sidebar.performanceTargets'), roles: ["officer", "president", "vice_president", "national_officer", "admin", mgmt] },
        { href: `/${locale}/dashboard/organizing`, icon: <Flag size={16} />, label: t('sidebar.organizingCampaigns'), roles: ["officer", "president", "vice_president", "national_officer", "admin", mgmt] },
        { href: `/${locale}/dashboard/strike-fund`, icon: <DollarSign size={16} />, label: t('sidebar.strikeFund'), roles: [...leadershipRoles, mgmt] },
        { href: `/${locale}/dashboard/notifications`, icon: <Bell size={16} />, label: t('sidebar.alerts'), roles: [...leadershipRoles, mgmt] },
        { href: `/${locale}/dashboard/pension/admin`, icon: <Briefcase size={16} />, label: t('sidebar.pensionAdmin'), roles: ["officer", "president", "secretary_treasurer", "national_officer", "admin", mgmt] },
        { href: `/${locale}/dashboard/pension/trustee`, icon: <Shield size={16} />, label: t('sidebar.trusteePortal'), roles: ["officer", "president", "secretary_treasurer", "national_officer", "admin", mgmt] },
      ],
    },
    {
      title: t('sidebar.executiveLeadership'),
      roles: [...execRoles, mgmt],
      items: [
        { href: `/${locale}/dashboard/executive`, icon: <Building2 size={16} />, label: t('sidebar.executiveDashboard'), roles: [...execRoles, mgmt] },
        { href: `/${locale}/dashboard/governance`, icon: <FileText size={16} />, label: t('sidebar.governance'), roles: [...execRoles, mgmt] },
        { href: `/${locale}/dashboard/audits`, icon: <FileBarChart size={16} />, label: t('sidebar.auditsCompliance'), roles: [...execRoles, "admin", mgmt] },
      ],
    },
  ];

  // ── Federation / CLC sections ──────────────────────────────────────────────
  const fedSections = [
    {
      title: t('sidebar.federationCLCServices'),
      roles: [...clcRoles, mgmt],
      items: [
        { href: `/${locale}/dashboard/cross-union-analytics`, icon: <GitCompare size={16} />, label: t('sidebar.crossUnionAnalytics'), roles: [...clcRoles, mgmt] },
        { href: `/${locale}/dashboard/precedents`, icon: <Scale size={16} />, label: t('sidebar.precedentDatabase'), roles: [...clcRoles, mgmt] },
        { href: `/${locale}/dashboard/clause-library`, icon: <Library size={16} />, label: t('sidebar.sharedClauseLibrary'), roles: [...clcRoles, mgmt] },
        { href: `/${locale}/dashboard/admin/organizations`, icon: <Building2 size={16} />, label: t('sidebar.affiliateManagement'), roles: ["congress_staff", "federation_staff", "fed_staff", "fed_executive", "system_admin", "national_officer", "admin", mgmt] },
        { href: `/${locale}/dashboard/compliance`, icon: <FileBarChart size={16} />, label: t('sidebar.complianceReports'), roles: ["congress_staff", "federation_staff", "fed_staff", "fed_executive", "system_admin", "admin", mgmt] },
        { href: `/${locale}/dashboard/sector-analytics`, icon: <BarChart3 size={16} />, label: t('sidebar.sectorAnalytics'), roles: ["congress_staff", "clc_staff", "clc_executive", "system_admin", "admin", mgmt] },
      ],
    },
    {
      title: t('sidebar.clcNationalOperations'),
      roles: ["clc_staff", "clc_executive", "system_admin", "admin", mgmt],
      items: [
        { href: `/${locale}/dashboard/clc`, icon: <Building2 size={16} />, label: t('sidebar.clcDashboard'), roles: ["clc_staff", "clc_executive", "system_admin", "admin", mgmt] },
        { href: `/${locale}/dashboard/clc/affiliates`, icon: <Network size={16} />, label: t('sidebar.affiliatesManagement'), roles: ["clc_staff", "clc_executive", "system_admin", "admin", mgmt] },
        { href: `/${locale}/dashboard/clc/staff`, icon: <Users size={16} />, label: t('sidebar.clcStaffOperations'), roles: ["clc_staff", "clc_executive", "system_admin", "admin", mgmt] },
        { href: `/${locale}/dashboard/clc/compliance`, icon: <FileBarChart size={16} />, label: t('sidebar.clcCompliance'), roles: ["clc_staff", "clc_executive", "system_admin", "admin", mgmt] },
      ],
    },
    {
      title: t('sidebar.provincialFederation'),
      roles: ["fed_staff", "fed_executive", "system_admin", "admin", mgmt],
      items: [
        { href: `/${locale}/dashboard/federation`, icon: <Network size={16} />, label: t('sidebar.federationDashboard'), roles: ["fed_staff", "fed_executive", "system_admin", "admin", mgmt] },
        { href: `/${locale}/dashboard/federation/affiliates`, icon: <Building2 size={16} />, label: t('sidebar.affiliateUnions'), roles: ["fed_staff", "fed_executive", "system_admin", "admin", mgmt] },
        { href: `/${locale}/dashboard/federation/remittances`, icon: <DollarSign size={16} />, label: t('sidebar.remittanceTracking'), roles: ["fed_staff", "fed_executive", "system_admin", "admin", mgmt] },
      ],
    },
  ];

  // ── System section (always at end) ─────────────────────────────────────────
  const systemSection = [
    {
      title: t('sidebar.system'),
      roles: ["admin", "system_admin", mgmt, ...nzilaAll],
      items: [
        { href: `/${locale}/dashboard/admin`, icon: <Shield size={16} />, label: t('navigation.adminPanel'), roles: ["admin", "system_admin", "app_owner", "coo", "cto", mgmt] },
        { href: `/${locale}/dashboard/settings`, icon: <Settings size={16} />, label: t('sidebar.preferences'), roles: [...unionAll, "system_admin", "congress_staff", "federation_staff", "clc_staff", "clc_executive", "fed_staff", "fed_executive", mgmt, ...nzilaAll] },
      ],
    },
  ];

  // ── Section shape (broad enough for all tiers) ──────────────────────────────
  type SidebarSection = {
    title: string;
    roles: string[];
    items: { href: string; icon: React.ReactNode; label: string; roles: string[] }[];
  };

  // ── Sections filtered by org type ──────────────────────────────────────────
  // Congress orgs (CLC) don't handle individual cases/grievances — strip
  // union-level sections like Representative Tools, claims, and committees.
  const orgType = organization?.type;
  const isCongressOrg = orgType === 'congress';
  const isFederationOrg = orgType === 'federation';

  const effectiveOrgSections: SidebarSection[] = isCongressOrg
    ? [
        // Congress orgs only get a minimal home link from orgSections
        {
          title: organization?.name ?? 'Congress',
          roles: [...unionAll, ...clcRoles, mgmt],
          items: [
            { href: `/${locale}/dashboard`, icon: <Home size={16} />, label: t('navigation.dashboard'), roles: [...unionAll, ...clcRoles, mgmt] },
          ],
        },
      ]
    : orgSections;

  // ── Assemble final navigation list based on role tier ──────────────────────
  const buildSections = useCallback(() => {
    let sections: SidebarSection[] = [];

    // When a platform admin is viewing a tenant org, show that tenant's nav
    // so they can see exactly what the tenant sees — but skip personal member
    // features (My Cases, Pension, Dues, Voting).  The "platform_viewer"
    // virtual role is only added to oversight/leadership items above.
    const effectiveRole = isViewingTenantOrg ? "platform_viewer" : userRole;

    if (isNzila && !isViewingTenantOrg) {
      // Platform view: show super-org nav
      sections = [...superOrgSections];
    } else if (isViewingTenantOrg) {
      // Platform admin viewing a tenant — show tenant sections
      if (isCongressOrg || isFederationOrg) {
        sections = [...effectiveOrgSections, ...fedSections];
      } else {
        sections = [...effectiveOrgSections];
      }
    } else {
      // Regular org-member view — scope by org type
      if (isCongressOrg) {
        // Congress: home + federation/CLC services only (no case management)
        sections = [...effectiveOrgSections, ...fedSections];
      } else if (isFederationOrg) {
        sections = [...effectiveOrgSections, ...fedSections];
      } else {
        // Union / local: standard union nav only (federation services not applicable)
        sections = [...effectiveOrgSections];
      }
    }

    // Always append system section
    sections = [...sections, ...systemSection];

    // Filter by effective role
    return sections
      .map(section => ({
        ...section,
        items: section.items.filter(item => item.roles.includes(effectiveRole)),
      }))
      .filter(section => section.items.length > 0 && section.roles.includes(effectiveRole));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, isNzila, isViewingTenantOrg, hasSelectedOrg, locale, organization]);

  const visibleSections = buildSections();

  // ── Render nav item ────────────────────────────────────────────────────────
  const renderItem = (item: { href: string; icon: React.ReactNode; label: string }) => (
    <Link key={item.href} href={item.href} className="block">
      <motion.div
        className={`flex items-center py-2 px-3 rounded-lg cursor-pointer transition-all ${
          isActive(item.href)
            ? "bg-linear-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30"
            : "text-gray-800 hover:bg-gray-100 hover:shadow-sm"
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
    <div className="h-screen w-15 md:w-55 bg-white/90 backdrop-blur-xl border-r border-gray-200 flex flex-col justify-between py-5 relative overflow-hidden">
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
            <Image
              src="/images/brand/icon.png"
              alt="Union Eyes"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg object-contain"
            />
            <div className="hidden md:block">
              <Image
                src="/images/brand/logo.png"
                alt="Union Eyes"
                width={96}
                height={24}
                className="h-6 object-contain"
              />
            </div>
          </motion.div>
        </Link>
      </div>

      {/* Org badge — shown when platform admin is viewing a tenant org */}
      {isViewingTenantOrg && organization && (
        <div className="px-3 mb-3 relative z-10">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700">
            <Building2 size={12} />
            <span className="text-[11px] font-medium truncate">Viewing: {organization.name}</span>
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

        <Link href={`/${locale}/dashboard/profile`}>
          <motion.div
            className="flex items-center px-3 py-3 hover:bg-gray-100 rounded-lg mx-2 cursor-pointer transition-colors"
            whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/80 flex items-center justify-center bg-white/80 shadow-sm">
              {isMounted ? (
                <UserButton
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
              <p className="text-xs text-gray-600">{t("sidebar.viewProfile")}</p>
            </div>
          </motion.div>
        </Link>
      </div>

    </div>
  );
}
