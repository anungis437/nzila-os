/**
 * Role-Based Access Control (RBAC) System
 * Union Claims Management System with CLC Integration
 * 
 * Defines user roles, permissions, and access control logic
 * Includes cross-organizational hierarchy for Canadian Labour Congress (CLC)
 */

// User roles in the system - aligned with ROLE_HIERARCHY
export enum UserRole {
  // ===== NZILA VENTURES - APP OPERATIONS =====
  // Strategic Leadership
  APP_OWNER = "app_owner",                         // CEO - Strategic ownership
  COO = "coo",                                     // Chief Operating Officer
  CTO = "cto",                                     // Chief Technology Officer
  
  // Operational Leadership
  PLATFORM_LEAD = "platform_lead",                 // Day-to-day operations
  CUSTOMER_SUCCESS_DIRECTOR = "customer_success_director",  // User success & retention
  
  // Department Managers
  SUPPORT_MANAGER = "support_manager",             // Support operations
  DATA_ANALYTICS_MANAGER = "data_analytics_manager",  // Analytics & BI
  BILLING_MANAGER = "billing_manager",             // Subscriptions & billing
  INTEGRATION_MANAGER = "integration_manager",     // APIs & partnerships
  COMPLIANCE_MANAGER = "compliance_manager",       // Platform compliance
  SECURITY_MANAGER = "security_manager",           // Security operations
  
  // Operations Staff
  SUPPORT_AGENT = "support_agent",                 // Customer support
  DATA_ANALYST = "data_analyst",                   // Data analysis
  BILLING_SPECIALIST = "billing_specialist",       // Billing operations
  INTEGRATION_SPECIALIST = "integration_specialist",  // Integration support
  
  // Content & Training
  CONTENT_MANAGER = "content_manager",             // Resources & training
  TRAINING_COORDINATOR = "training_coordinator",   // User training
  
  // ===== SYSTEM ADMINISTRATION =====
  SYSTEM_ADMIN = "system_admin",                   // Technical operations
  
  // ===== CLC NATIONAL (CONGRESS) LEVEL =====
  CLC_EXECUTIVE = "clc_executive",                 // CLC President, Secretary-Treasurer
  CLC_STAFF = "clc_staff",                         // CLC national staff
  
  // ===== FEDERATION LEVEL =====
  FED_EXECUTIVE = "fed_executive",                 // Federation President, VP
  FED_STAFF = "fed_staff",                         // Provincial federation staff
  
  // ===== UNION NATIONAL LEVEL =====
  NATIONAL_OFFICER = "national_officer",           // National union officers
  
  // ===== LOCAL UNION EXECUTIVES =====
  ADMIN = "admin",                                 // Organization Administrator
  PRESIDENT = "president",                         // Union President
  VICE_PRESIDENT = "vice_president",               // Vice President
  SECRETARY_TREASURER = "secretary_treasurer",     // Secretary-Treasurer
  
  // ===== SENIOR REPRESENTATIVES =====
  CHIEF_STEWARD = "chief_steward",                 // Chief Steward
  OFFICER = "officer",                             // Union Officer
  
  // ===== ADMINISTRATIVE SUPPORT =====
  CLERK = "clerk",                                 // Admin Clerk — drafts, prepares, dispatches correspondence
  
  // ===== FRONT-LINE REPRESENTATIVES =====
  STEWARD = "steward",                             // Union Steward
  BARGAINING_COMMITTEE = "bargaining_committee",   // Bargaining Committee Member
  
  // ===== SPECIALIZED REPRESENTATIVES =====
  HEALTH_SAFETY_REP = "health_safety_rep",         // Health & Safety Rep
  
  // ===== BASE MEMBERSHIP =====
  MEMBER = "member",                               // Union Member
  
  // ===== LEGACY (BACKWARD COMPATIBILITY) =====
  GUEST = "guest",                                 // Deprecated
  CONGRESS_STAFF = "congress_staff",               // Deprecated: Use CLC_STAFF
  FEDERATION_STAFF = "federation_staff",           // Deprecated: Use FED_STAFF
  UNION_REP = "union_rep",                         // Deprecated: Use STEWARD
  STAFF_REP = "staff_rep",                         // Deprecated: Use STEWARD
}

// Permissions that can be assigned to roles
export enum Permission {
  // ===== APP OPERATIONS PERMISSIONS =====
  // Platform Operations
  VIEW_PLATFORM_HEALTH = "view_platform_health",
  MANAGE_PLATFORM_OPERATIONS = "manage_platform_operations",
  VIEW_SYSTEM_METRICS = "view_system_metrics",
  MANAGE_INCIDENTS = "manage_incidents",
  VIEW_SLA_DASHBOARD = "view_sla_dashboard",
  MANAGE_RELEASES = "manage_releases",
  VIEW_CAPACITY_PLANNING = "view_capacity_planning",
  
  // Customer Success
  VIEW_CUSTOMER_HEALTH = "view_customer_health",
  MANAGE_CUSTOMER_SUCCESS = "manage_customer_success",
  VIEW_CHURN_RISK = "view_churn_risk",
  MANAGE_ONBOARDING = "manage_onboarding",
  VIEW_ADOPTION_METRICS = "view_adoption_metrics",
  MANAGE_CUSTOMER_FEEDBACK = "manage_customer_feedback",
  
  // Support Operations
  VIEW_SUPPORT_TICKETS = "view_support_tickets",
  MANAGE_SUPPORT_OPERATIONS = "manage_support_operations",
  ASSIGN_TICKETS = "assign_tickets",
  VIEW_SUPPORT_METRICS = "view_support_metrics",
  MANAGE_KNOWLEDGE_BASE = "manage_knowledge_base",
  ESCALATE_TICKETS = "escalate_tickets",
  
  // Data & Analytics (Platform-wide)
  VIEW_CROSS_ORG_ANALYTICS = "VIEW_CROSS_ORG_ANALYTICS",
  MANAGE_PLATFORM_ANALYTICS = "manage_platform_analytics",
  CREATE_CUSTOM_REPORTS = "create_custom_reports",
  EXPORT_PLATFORM_DATA = "export_platform_data",
  MANAGE_BI_INTEGRATIONS = "manage_bi_integrations",
  VIEW_USAGE_TRENDS = "view_usage_trends",
  
  // Billing & Finance (Platform)
  VIEW_ALL_SUBSCRIPTIONS = "view_all_subscriptions",
  MANAGE_SUBSCRIPTIONS = "manage_subscriptions",
  VIEW_REVENUE_DASHBOARD = "view_revenue_dashboard",
  MANAGE_INVOICING = "manage_invoicing",
  PROCESS_PAYMENTS = "process_payments",
  VIEW_FINANCIAL_REPORTS = "view_financial_reports",
  
  // Integration Management
  VIEW_API_INTEGRATIONS = "view_api_integrations",
  MANAGE_API_KEYS = "manage_api_keys",
  MONITOR_WEBHOOKS = "monitor_webhooks",
  MANAGE_PARTNER_INTEGRATIONS = "manage_partner_integrations",
  VIEW_INTEGRATION_HEALTH = "view_integration_health",
  MANAGE_OAUTH_APPS = "manage_oauth_apps",
  
  // Compliance Operations
  VIEW_AUDIT_LOGS = "view_audit_logs",
  MANAGE_COMPLIANCE_REPORTS = "manage_compliance_reports",
  ENFORCE_POLICIES = "enforce_policies",
  MONITOR_GDPR_COMPLIANCE = "monitor_gdpr_compliance",
  MANAGE_RISK_ASSESSMENTS = "manage_risk_assessments",
  GENERATE_REGULATORY_REPORTS = "generate_regulatory_reports",
  
  // Security Operations
  VIEW_SECURITY_ALERTS = "view_security_alerts",
  MANAGE_SECURITY_INCIDENTS = "manage_security_incidents",
  AUDIT_USER_ACCESS = "audit_user_access",
  MONITOR_THREATS = "monitor_threats",
  MANAGE_VULNERABILITIES = "manage_vulnerabilities",
  VIEW_SECURITY_REPORTS = "view_security_reports",
  
  // Content Management
  MANAGE_TEMPLATES = "manage_templates",
  MANAGE_RESOURCE_LIBRARY = "manage_resource_library",
  CREATE_TRAINING_MATERIALS = "create_training_materials",
  MANAGE_DOCUMENTATION = "manage_documentation",
  CREATE_ANNOUNCEMENTS = "create_announcements",
  MANAGE_EMAIL_TEMPLATES = "manage_email_templates",
  
  // Strategic Operations
  VIEW_STRATEGIC_DASHBOARD = "view_strategic_dashboard",
  MANAGE_ROADMAP = "manage_roadmap",
  VIEW_STAKEHOLDER_REPORTS = "view_stakeholder_reports",
  MANAGE_PARTNERSHIPS = "manage_partnerships",
  VIEW_PLATFORM_KPIS = "view_platform_kpis",
  
  // ===== UNION APPLICATION PERMISSIONS =====
  // Claims permissions
  VIEW_ALL_CLAIMS = "view_all_claims",
  VIEW_OWN_CLAIMS = "view_own_claims",
  CREATE_CLAIM = "create_claim",
  EDIT_ALL_CLAIMS = "edit_all_claims",
  EDIT_OWN_CLAIMS = "edit_own_claims",
  DELETE_CLAIM = "delete_claim",
  APPROVE_CLAIM = "approve_claim",
  
  // Member permissions
  VIEW_ALL_MEMBERS = "view_all_members",
  VIEW_OWN_PROFILE = "view_own_profile",
  EDIT_MEMBER = "edit_member",
  DELETE_MEMBER = "delete_member",
  INVITE_MEMBER = "invite_member",
  
  // Voting permissions
  VIEW_VOTING = "view_voting",
  CREATE_VOTE = "create_vote",
  CAST_VOTE = "cast_vote",
  MANAGE_VOTING = "manage_voting",
  VIEW_VOTE_RESULTS = "view_vote_results",
  
  // CBA permissions
  VIEW_CBA = "view_cba",
  EDIT_CBA = "edit_cba",
  CREATE_CBA = "create_cba",
  DELETE_CBA = "delete_cba",
  SIGN_CBA = "sign_cba",                           // President/authorized signatory
  RATIFY_CBA = "ratify_cba",                       // Membership ratification
  CONTRACT_ADMINISTRATION = "contract_administration", // Bargaining chair
  
  // Financial permissions
  VIEW_FINANCIAL = "view_financial",
  EDIT_FINANCIAL = "edit_financial",
  APPROVE_FINANCIAL = "approve_financial",
  MANAGE_FINANCES = "manage_finances",              // Secretary-Treasurer
  AUDIT_FINANCES = "audit_finances",
  
  // Governance permissions
  APPOINT_COMMITTEES = "appoint_committees",        // Executive officers
  MANAGE_ELECTIONS = "manage_elections",
  DELEGATE_AUTHORITY = "delegate_authority",
  APPROVE_APPOINTMENTS = "approve_appointments",
  
  // Claims assignment
  ASSIGN_CLAIMS = "assign_claims",                  // Chief steward, stewards
  
  // Health & Safety permissions
  VIEW_HEALTH_SAFETY_CLAIMS = "view_health_safety_claims",
  CREATE_HEALTH_SAFETY_CLAIM = "create_health_safety_claim",
  MANAGE_HEALTH_SAFETY = "manage_health_safety",
  
  // Analytics permissions
  VIEW_ANALYTICS = "view_analytics",
  VIEW_ADVANCED_ANALYTICS = "view_advanced_analytics",
  
  // Cross-organizational permissions (Congress/Federation)
  VIEW_CROSS_UNION_ANALYTICS = "view_cross_union_analytics",
  MANAGE_CROSS_UNION_ANALYTICS = "manage_cross_union_analytics",
  VIEW_PRECEDENT_DATABASE = "view_precedent_database",
  MANAGE_PRECEDENT_DATABASE = "manage_precedent_database",
  VIEW_CLAUSE_LIBRARY = "view_clause_library",
  MANAGE_CLAUSE_LIBRARY = "manage_clause_library",
  VIEW_FEDERATION_ANALYTICS = "view_federation_analytics",
  VIEW_CONGRESS_ANALYTICS = "view_congress_analytics",
  MANAGE_AFFILIATES = "manage_affiliates",
  VIEW_ALL_ORGANIZATIONS = "view_all_organizations",
  MANAGE_ORGANIZATIONS = "manage_organizations",
  VIEW_COMPLIANCE_REPORTS = "view_compliance_reports",
  MANAGE_SECTOR_ANALYTICS = "manage_sector_analytics",
  
  // CLC-specific permissions
  CLC_EXECUTIVE_DASHBOARD = "clc_executive_dashboard",
  MANAGE_CLC_REMITTANCES = "manage_clc_remittances",
  VIEW_CLC_REMITTANCES = "view_clc_remittances",
  MANAGE_AFFILIATE_SYNC = "manage_affiliate_sync",
  CLC_COMPLIANCE_REPORTS = "clc_compliance_reports",
  
  // Federation-specific permissions
  FEDERATION_DASHBOARD = "federation_dashboard",
  VIEW_PROVINCIAL_AFFILIATES = "view_provincial_affiliates",
  MANAGE_PROVINCIAL_AFFILIATES = "manage_provincial_affiliates",
  VIEW_PROVINCIAL_REMITTANCES = "view_provincial_remittances",
  PROVINCIAL_COMPLIANCE = "provincial_compliance",
  
  // Admin permissions
  MANAGE_USERS = "manage_users",
  MANAGE_ROLES = "manage_roles",
  SYSTEM_SETTINGS = "system_settings",
  VIEW_ADMIN_PANEL = "view_admin_panel",

  // Correspondence pipeline permissions
  VIEW_CORRESPONDENCE = "view_correspondence",
  DRAFT_CORRESPONDENCE = "draft_correspondence",
  MANAGE_CORRESPONDENCE = "manage_correspondence",
  SIGN_CORRESPONDENCE = "sign_correspondence",
  DISPATCH_CORRESPONDENCE = "dispatch_correspondence",
}

// Role definitions with their permissions
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // ========================================================
  // NZILA VENTURES - APP OPERATIONS ROLES
  // ========================================================
  
  [UserRole.APP_OWNER]: [
    // CEO - Strategic ownership with complete platform visibility
    // Full access to all strategic and operational dashboards
    Permission.VIEW_STRATEGIC_DASHBOARD,
    Permission.MANAGE_ROADMAP,
    Permission.VIEW_STAKEHOLDER_REPORTS,
    Permission.MANAGE_PARTNERSHIPS,
    Permission.VIEW_PLATFORM_KPIS,
    Permission.VIEW_PLATFORM_HEALTH,
    Permission.VIEW_SYSTEM_METRICS,
    Permission.VIEW_CUSTOMER_HEALTH,
    Permission.VIEW_REVENUE_DASHBOARD,
    Permission.VIEW_CROSS_ORG_ANALYTICS,
    Permission.VIEW_USAGE_TRENDS,
    Permission.VIEW_ALL_SUBSCRIPTIONS,
    Permission.VIEW_FINANCIAL_REPORTS,
    Permission.VIEW_SUPPORT_METRICS,
    Permission.VIEW_SECURITY_REPORTS,
    Permission.VIEW_AUDIT_LOGS,
    // Union & CLC/Federation visibility (app owner sees everything)
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    Permission.MANAGE_USERS,
    Permission.MANAGE_ROLES,
    Permission.SYSTEM_SETTINGS,
    Permission.VIEW_ADMIN_PANEL,
    Permission.CLC_EXECUTIVE_DASHBOARD,
    Permission.MANAGE_CLC_REMITTANCES,
    Permission.VIEW_CLC_REMITTANCES,
    Permission.MANAGE_AFFILIATE_SYNC,
    Permission.CLC_COMPLIANCE_REPORTS,
    Permission.FEDERATION_DASHBOARD,
    Permission.VIEW_PROVINCIAL_AFFILIATES,
    Permission.MANAGE_PROVINCIAL_AFFILIATES,
    Permission.VIEW_PROVINCIAL_REMITTANCES,
    Permission.PROVINCIAL_COMPLIANCE,
    Permission.VIEW_CROSS_UNION_ANALYTICS,
    Permission.MANAGE_CROSS_UNION_ANALYTICS,
    Permission.VIEW_CONGRESS_ANALYTICS,
    Permission.VIEW_FEDERATION_ANALYTICS,
    Permission.VIEW_ALL_ORGANIZATIONS,
    Permission.MANAGE_ORGANIZATIONS,
    Permission.VIEW_COMPLIANCE_REPORTS,
    Permission.MANAGE_SECTOR_ANALYTICS,
    Permission.VIEW_PRECEDENT_DATABASE,
    Permission.MANAGE_PRECEDENT_DATABASE,
    Permission.VIEW_CLAUSE_LIBRARY,
    Permission.MANAGE_CLAUSE_LIBRARY,
    Permission.MANAGE_AFFILIATES,
  ],
  
  [UserRole.COO]: [
    // COO - Overall platform operations with full operational visibility
    Permission.MANAGE_PLATFORM_OPERATIONS,
    Permission.VIEW_PLATFORM_HEALTH,
    Permission.VIEW_SYSTEM_METRICS,
    Permission.MANAGE_INCIDENTS,
    Permission.VIEW_SLA_DASHBOARD,
    Permission.MANAGE_RELEASES,
    Permission.VIEW_CAPACITY_PLANNING,
    Permission.VIEW_CUSTOMER_HEALTH,
    Permission.VIEW_SUPPORT_METRICS,
    Permission.VIEW_CROSS_ORG_ANALYTICS,
    Permission.VIEW_USAGE_TRENDS,
    Permission.VIEW_STRATEGIC_DASHBOARD,
    Permission.VIEW_PLATFORM_KPIS,
  ],
  
  [UserRole.CTO]: [
    // CTO - Technology leadership with full technical visibility
    Permission.MANAGE_PLATFORM_OPERATIONS,
    Permission.VIEW_PLATFORM_HEALTH,
    Permission.VIEW_SYSTEM_METRICS,
    Permission.MANAGE_INCIDENTS,
    Permission.VIEW_SLA_DASHBOARD,
    Permission.MANAGE_RELEASES,
    Permission.VIEW_CAPACITY_PLANNING,
    Permission.VIEW_SECURITY_ALERTS,
    Permission.MANAGE_SECURITY_INCIDENTS,
    Permission.VIEW_SECURITY_REPORTS,
    Permission.MANAGE_API_KEYS,
    Permission.VIEW_API_INTEGRATIONS,
    Permission.VIEW_INTEGRATION_HEALTH,
    Permission.VIEW_AUDIT_LOGS,
    Permission.VIEW_CROSS_ORG_ANALYTICS,
  ],
  
  [UserRole.PLATFORM_LEAD]: [
    // Platform Manager - Day-to-day operational management
    Permission.MANAGE_PLATFORM_OPERATIONS,
    Permission.VIEW_PLATFORM_HEALTH,
    Permission.VIEW_SYSTEM_METRICS,
    Permission.MANAGE_INCIDENTS,
    Permission.VIEW_SLA_DASHBOARD,
    Permission.MANAGE_RELEASES,
    Permission.VIEW_CAPACITY_PLANNING,
    Permission.VIEW_SUPPORT_METRICS,
    Permission.VIEW_CUSTOMER_HEALTH,
    Permission.VIEW_SECURITY_ALERTS,
    Permission.VIEW_CROSS_ORG_ANALYTICS,
    Permission.VIEW_USAGE_TRENDS,
  ],
  
  [UserRole.CUSTOMER_SUCCESS_DIRECTOR]: [
    // Customer Success Director - Customer retention & growth
    Permission.VIEW_CUSTOMER_HEALTH,
    Permission.MANAGE_CUSTOMER_SUCCESS,
    Permission.VIEW_CHURN_RISK,
    Permission.MANAGE_ONBOARDING,
    Permission.VIEW_ADOPTION_METRICS,
    Permission.MANAGE_CUSTOMER_FEEDBACK,
    Permission.VIEW_SUPPORT_TICKETS,
    Permission.VIEW_SUPPORT_METRICS,
    Permission.VIEW_ALL_SUBSCRIPTIONS,
    Permission.VIEW_CROSS_ORG_ANALYTICS,
    Permission.VIEW_USAGE_TRENDS,
  ],
  
  [UserRole.SUPPORT_MANAGER]: [
    // Support Manager - Help desk and support operations
    Permission.VIEW_SUPPORT_TICKETS,
    Permission.MANAGE_SUPPORT_OPERATIONS,
    Permission.ASSIGN_TICKETS,
    Permission.VIEW_SUPPORT_METRICS,
    Permission.MANAGE_KNOWLEDGE_BASE,
    Permission.ESCALATE_TICKETS,
    Permission.VIEW_CUSTOMER_HEALTH,
    Permission.MANAGE_CUSTOMER_FEEDBACK,
  ],
  
  [UserRole.DATA_ANALYTICS_MANAGER]: [
    // Analytics Manager - Platform-wide analytics and BI
    Permission.VIEW_CROSS_ORG_ANALYTICS,
    Permission.MANAGE_PLATFORM_ANALYTICS,
    Permission.CREATE_CUSTOM_REPORTS,
    Permission.EXPORT_PLATFORM_DATA,
    Permission.MANAGE_BI_INTEGRATIONS,
    Permission.VIEW_USAGE_TRENDS,
    Permission.VIEW_CUSTOMER_HEALTH,
    Permission.VIEW_ADOPTION_METRICS,
    Permission.VIEW_SYSTEM_METRICS,
  ],
  
  [UserRole.BILLING_MANAGER]: [
    // Billing Manager - Subscriptions and payment operations
    Permission.VIEW_ALL_SUBSCRIPTIONS,
    Permission.MANAGE_SUBSCRIPTIONS,
    Permission.VIEW_REVENUE_DASHBOARD,
    Permission.MANAGE_INVOICING,
    Permission.PROCESS_PAYMENTS,
    Permission.VIEW_FINANCIAL_REPORTS,
    Permission.VIEW_CUSTOMER_HEALTH,
  ],
  
  [UserRole.INTEGRATION_MANAGER]: [
    // Integration Manager - APIs and third-party partnerships
    Permission.VIEW_API_INTEGRATIONS,
    Permission.MANAGE_API_KEYS,
    Permission.MONITOR_WEBHOOKS,
    Permission.MANAGE_PARTNER_INTEGRATIONS,
    Permission.VIEW_INTEGRATION_HEALTH,
    Permission.MANAGE_OAUTH_APPS,
    Permission.VIEW_SYSTEM_METRICS,
  ],
  
  [UserRole.COMPLIANCE_MANAGER]: [
    // Compliance Manager - Platform compliance and auditing
    Permission.VIEW_AUDIT_LOGS,
    Permission.MANAGE_COMPLIANCE_REPORTS,
    Permission.ENFORCE_POLICIES,
    Permission.MONITOR_GDPR_COMPLIANCE,
    Permission.MANAGE_RISK_ASSESSMENTS,
    Permission.GENERATE_REGULATORY_REPORTS,
    Permission.VIEW_SECURITY_ALERTS,
    Permission.VIEW_CROSS_ORG_ANALYTICS,
  ],
  
  [UserRole.SECURITY_MANAGER]: [
    // Security Manager - Security monitoring and incident response
    Permission.VIEW_SECURITY_ALERTS,
    Permission.MANAGE_SECURITY_INCIDENTS,
    Permission.AUDIT_USER_ACCESS,
    Permission.MONITOR_THREATS,
    Permission.MANAGE_VULNERABILITIES,
    Permission.VIEW_SECURITY_REPORTS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.VIEW_SYSTEM_METRICS,
  ],
  
  [UserRole.SUPPORT_AGENT]: [
    // Support Agent - Customer support and ticket handling
    Permission.VIEW_SUPPORT_TICKETS,
    Permission.ASSIGN_TICKETS,
    Permission.ESCALATE_TICKETS,
    Permission.MANAGE_KNOWLEDGE_BASE,
  ],
  
  [UserRole.DATA_ANALYST]: [
    // Data Analyst - Analytics and reporting
    Permission.VIEW_CROSS_ORG_ANALYTICS,
    Permission.CREATE_CUSTOM_REPORTS,
    Permission.EXPORT_PLATFORM_DATA,
    Permission.VIEW_USAGE_TRENDS,
    Permission.VIEW_ADOPTION_METRICS,
  ],
  
  [UserRole.BILLING_SPECIALIST]: [
    // Billing Specialist - Billing operations
    Permission.VIEW_ALL_SUBSCRIPTIONS,
    Permission.MANAGE_SUBSCRIPTIONS,
    Permission.MANAGE_INVOICING,
    Permission.PROCESS_PAYMENTS,
    Permission.VIEW_REVENUE_DASHBOARD,
  ],
  
  [UserRole.INTEGRATION_SPECIALIST]: [
    // Integration Specialist - API support
    Permission.VIEW_API_INTEGRATIONS,
    Permission.MANAGE_API_KEYS,
    Permission.MONITOR_WEBHOOKS,
    Permission.VIEW_INTEGRATION_HEALTH,
  ],
  
  [UserRole.CONTENT_MANAGER]: [
    // Content Manager - Resources and training materials
    Permission.MANAGE_TEMPLATES,
    Permission.MANAGE_RESOURCE_LIBRARY,
    Permission.CREATE_TRAINING_MATERIALS,
    Permission.MANAGE_DOCUMENTATION,
    Permission.CREATE_ANNOUNCEMENTS,
    Permission.MANAGE_EMAIL_TEMPLATES,
  ],
  
  [UserRole.TRAINING_COORDINATOR]: [
    // Training Coordinator - User training and onboarding
    Permission.CREATE_TRAINING_MATERIALS,
    Permission.MANAGE_RESOURCE_LIBRARY,
    Permission.MANAGE_ONBOARDING,
    Permission.VIEW_ADOPTION_METRICS,
  ],
  
  // ========================================================
  // SYSTEM ADMINISTRATION & UNION ROLES
  // ========================================================
  
  [UserRole.SYSTEM_ADMIN]: [
    // System administrators have complete access to all features
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.CREATE_CLAIM,
    Permission.EDIT_ALL_CLAIMS,
    Permission.EDIT_OWN_CLAIMS,
    Permission.DELETE_CLAIM,
    Permission.APPROVE_CLAIM,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_MEMBER,
    Permission.DELETE_MEMBER,
    Permission.INVITE_MEMBER,
    Permission.VIEW_VOTING,
    Permission.CREATE_VOTE,
    Permission.CAST_VOTE,
    Permission.MANAGE_VOTING,
    Permission.VIEW_VOTE_RESULTS,
    Permission.VIEW_CBA,
    Permission.EDIT_CBA,
    Permission.CREATE_CBA,
    Permission.DELETE_CBA,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    Permission.MANAGE_USERS,
    Permission.MANAGE_ROLES,
    Permission.SYSTEM_SETTINGS,
    Permission.VIEW_ADMIN_PANEL,
    // CLC & Federation permissions
    Permission.CLC_EXECUTIVE_DASHBOARD,
    Permission.MANAGE_CLC_REMITTANCES,
    Permission.VIEW_CLC_REMITTANCES,
    Permission.MANAGE_AFFILIATE_SYNC,
    Permission.CLC_COMPLIANCE_REPORTS,
    Permission.FEDERATION_DASHBOARD,
    Permission.VIEW_PROVINCIAL_AFFILIATES,
    Permission.MANAGE_PROVINCIAL_AFFILIATES,
    Permission.VIEW_PROVINCIAL_REMITTANCES,
    Permission.PROVINCIAL_COMPLIANCE,
    Permission.VIEW_CROSS_UNION_ANALYTICS,
    Permission.MANAGE_CROSS_UNION_ANALYTICS,
    Permission.VIEW_CONGRESS_ANALYTICS,
    Permission.VIEW_FEDERATION_ANALYTICS,
    Permission.VIEW_ALL_ORGANIZATIONS,
    Permission.MANAGE_ORGANIZATIONS,
    Permission.VIEW_COMPLIANCE_REPORTS,
    Permission.MANAGE_SECTOR_ANALYTICS,
    Permission.VIEW_PRECEDENT_DATABASE,
    Permission.MANAGE_PRECEDENT_DATABASE,
    Permission.VIEW_CLAUSE_LIBRARY,
    Permission.MANAGE_CLAUSE_LIBRARY,
    Permission.MANAGE_AFFILIATES,
  ],
  
  [UserRole.CLC_EXECUTIVE]: [
    // CLC President, Secretary-Treasurer - executive oversight of entire CLC
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    
    // CLC Executive Dashboard & Remittances
    Permission.CLC_EXECUTIVE_DASHBOARD,
    Permission.MANAGE_CLC_REMITTANCES,
    Permission.VIEW_CLC_REMITTANCES,
    Permission.MANAGE_AFFILIATE_SYNC,
    Permission.CLC_COMPLIANCE_REPORTS,
    
    // Cross-organizational features (full access)
    Permission.VIEW_CROSS_UNION_ANALYTICS,
    Permission.MANAGE_CROSS_UNION_ANALYTICS,
    Permission.VIEW_CONGRESS_ANALYTICS,
    Permission.VIEW_FEDERATION_ANALYTICS,
    Permission.VIEW_ALL_ORGANIZATIONS,
    Permission.MANAGE_ORGANIZATIONS,
    Permission.VIEW_COMPLIANCE_REPORTS,
    Permission.MANAGE_SECTOR_ANALYTICS,
    
    // Shared knowledge resources (full management)
    Permission.VIEW_PRECEDENT_DATABASE,
    Permission.MANAGE_PRECEDENT_DATABASE,
    Permission.VIEW_CLAUSE_LIBRARY,
    Permission.MANAGE_CLAUSE_LIBRARY,
    
    // Collective agreements & voting (view only)
    Permission.VIEW_CBA,
    Permission.VIEW_VOTING,
    Permission.VIEW_VOTE_RESULTS,
    
    // Analytics (advanced access)
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    
    // Affiliate management
    Permission.MANAGE_AFFILIATES,
  ],
  
  [UserRole.CLC_STAFF]: [
    // CLC national staff - operational support for CLC
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    
    // CLC Staff operations
    Permission.VIEW_CLC_REMITTANCES,
    Permission.MANAGE_AFFILIATE_SYNC,
    Permission.CLC_COMPLIANCE_REPORTS,
    
    // Cross-organizational features (full access)
    Permission.VIEW_CROSS_UNION_ANALYTICS,
    Permission.MANAGE_CROSS_UNION_ANALYTICS,
    Permission.VIEW_CONGRESS_ANALYTICS,
    Permission.VIEW_FEDERATION_ANALYTICS,
    Permission.VIEW_ALL_ORGANIZATIONS,
    Permission.VIEW_COMPLIANCE_REPORTS,
    Permission.MANAGE_SECTOR_ANALYTICS,
    
    // Shared knowledge resources (full management)
    Permission.VIEW_PRECEDENT_DATABASE,
    Permission.MANAGE_PRECEDENT_DATABASE,
    Permission.VIEW_CLAUSE_LIBRARY,
    Permission.MANAGE_CLAUSE_LIBRARY,
    
    // Collective agreements & voting (view only)
    Permission.VIEW_CBA,
    Permission.VIEW_VOTING,
    Permission.VIEW_VOTE_RESULTS,
    
    // Analytics (advanced access)
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    
    // Affiliate management (view and support)
    Permission.VIEW_ALL_ORGANIZATIONS,
    Permission.MANAGE_AFFILIATES,
  ],
  
  [UserRole.FED_EXECUTIVE]: [
    // Federation President, VP - executive oversight of provincial federation
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    
    // Federation Executive Dashboard
    Permission.FEDERATION_DASHBOARD,
    Permission.VIEW_PROVINCIAL_AFFILIATES,
    Permission.MANAGE_PROVINCIAL_AFFILIATES,
    Permission.VIEW_PROVINCIAL_REMITTANCES,
    Permission.PROVINCIAL_COMPLIANCE,
    
    // Cross-organizational features (scoped to federation)
    Permission.VIEW_CROSS_UNION_ANALYTICS,
    Permission.VIEW_FEDERATION_ANALYTICS,
    Permission.VIEW_ALL_ORGANIZATIONS,
    Permission.VIEW_COMPLIANCE_REPORTS,
    
    // Shared knowledge resources (view and contribute)
    Permission.VIEW_PRECEDENT_DATABASE,
    Permission.MANAGE_PRECEDENT_DATABASE,
    Permission.VIEW_CLAUSE_LIBRARY,
    Permission.MANAGE_CLAUSE_LIBRARY,
    
    // Collective agreements & voting (view only)
    Permission.VIEW_CBA,
    Permission.VIEW_VOTING,
    Permission.VIEW_VOTE_RESULTS,
    
    // Analytics (advanced access within federation)
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    
    // Affiliate management (within federation)
    Permission.MANAGE_AFFILIATES,
  ],
  
  [UserRole.FED_STAFF]: [
    // Provincial federation staff - operational support
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    
    // Federation operations
    Permission.FEDERATION_DASHBOARD,
    Permission.VIEW_PROVINCIAL_AFFILIATES,
    Permission.VIEW_PROVINCIAL_REMITTANCES,
    Permission.PROVINCIAL_COMPLIANCE,
    
    // Cross-organizational features (scoped to federation)
    Permission.VIEW_CROSS_UNION_ANALYTICS,
    Permission.VIEW_FEDERATION_ANALYTICS,
    Permission.VIEW_ALL_ORGANIZATIONS,
    Permission.VIEW_COMPLIANCE_REPORTS,
    
    // Shared knowledge resources (view and contribute)
    Permission.VIEW_PRECEDENT_DATABASE,
    Permission.MANAGE_PRECEDENT_DATABASE,
    Permission.VIEW_CLAUSE_LIBRARY,
    Permission.MANAGE_CLAUSE_LIBRARY,
    
    // Collective agreements & voting (view only)
    Permission.VIEW_CBA,
    Permission.VIEW_VOTING,
    Permission.VIEW_VOTE_RESULTS,
    
    // Analytics (advanced access within federation)
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    
    // Affiliate management (within federation)
    Permission.MANAGE_AFFILIATES,
  ],
  
  [UserRole.NATIONAL_OFFICER]: [
    // National union officers - leadership at union level
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.CREATE_CLAIM,
    Permission.EDIT_ALL_CLAIMS,
    Permission.EDIT_OWN_CLAIMS,
    Permission.APPROVE_CLAIM,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_MEMBER,
    Permission.INVITE_MEMBER,
    Permission.VIEW_VOTING,
    Permission.CREATE_VOTE,
    Permission.CAST_VOTE,
    Permission.MANAGE_VOTING,
    Permission.VIEW_VOTE_RESULTS,
    Permission.VIEW_CBA,
    Permission.EDIT_CBA,
    Permission.CREATE_CBA,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    Permission.VIEW_PRECEDENT_DATABASE,
    Permission.MANAGE_PRECEDENT_DATABASE,
    Permission.VIEW_CLAUSE_LIBRARY,
    Permission.MANAGE_CLAUSE_LIBRARY,
  ],
  
  [UserRole.CONGRESS_STAFF]: [
    // Legacy role - maps to CLC_STAFF (deprecated)
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    
    // Cross-organizational features (full access)
    Permission.VIEW_CROSS_UNION_ANALYTICS,
    Permission.MANAGE_CROSS_UNION_ANALYTICS,
    Permission.VIEW_CONGRESS_ANALYTICS,
    Permission.VIEW_FEDERATION_ANALYTICS,
    Permission.VIEW_ALL_ORGANIZATIONS,
    Permission.VIEW_COMPLIANCE_REPORTS,
    Permission.MANAGE_SECTOR_ANALYTICS,
    
    // Shared knowledge resources (full management)
    Permission.VIEW_PRECEDENT_DATABASE,
    Permission.MANAGE_PRECEDENT_DATABASE,
    Permission.VIEW_CLAUSE_LIBRARY,
    Permission.MANAGE_CLAUSE_LIBRARY,
    
    // Collective agreements & voting (view only)
    Permission.VIEW_CBA,
    Permission.VIEW_VOTING,
    Permission.VIEW_VOTE_RESULTS,
    
    // Analytics (advanced access)
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    
    // Affiliate management
    Permission.VIEW_ALL_ORGANIZATIONS,
    Permission.MANAGE_AFFILIATES,
  ],
  
  [UserRole.FEDERATION_STAFF]: [
    // Federation staff have provincial/regional cross-organizational visibility
    // Claims & Members (view across federation affiliates only)
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    
    // Cross-organizational features (scoped to federation)
    Permission.VIEW_CROSS_UNION_ANALYTICS,
    Permission.VIEW_FEDERATION_ANALYTICS,
    Permission.VIEW_ALL_ORGANIZATIONS,
    Permission.VIEW_COMPLIANCE_REPORTS,
    
    // Shared knowledge resources (view and contribute)
    Permission.VIEW_PRECEDENT_DATABASE,
    Permission.MANAGE_PRECEDENT_DATABASE,
    Permission.VIEW_CLAUSE_LIBRARY,
    Permission.MANAGE_CLAUSE_LIBRARY,
    
    // Collective agreements & voting (view only)
    Permission.VIEW_CBA,
    Permission.VIEW_VOTING,
    Permission.VIEW_VOTE_RESULTS,
    
    // Analytics (advanced access within federation)
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    
    // Affiliate management (within federation)
    Permission.MANAGE_AFFILIATES,
  ],
  
  [UserRole.ADMIN]: [
    // Full access to everything
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.CREATE_CLAIM,
    Permission.EDIT_ALL_CLAIMS,
    Permission.EDIT_OWN_CLAIMS,
    Permission.DELETE_CLAIM,
    Permission.APPROVE_CLAIM,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_MEMBER,
    Permission.DELETE_MEMBER,
    Permission.INVITE_MEMBER,
    Permission.VIEW_VOTING,
    Permission.CREATE_VOTE,
    Permission.CAST_VOTE,
    Permission.MANAGE_VOTING,
    Permission.VIEW_VOTE_RESULTS,
    Permission.VIEW_CBA,
    Permission.EDIT_CBA,
    Permission.CREATE_CBA,
    Permission.DELETE_CBA,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    Permission.MANAGE_USERS,
    Permission.MANAGE_ROLES,
    Permission.SYSTEM_SETTINGS,
    Permission.VIEW_ADMIN_PANEL,
  ],
  
  [UserRole.UNION_REP]: [
    // Union representatives have broad access
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.CREATE_CLAIM,
    Permission.EDIT_ALL_CLAIMS,
    Permission.EDIT_OWN_CLAIMS,
    Permission.APPROVE_CLAIM,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_MEMBER,
    Permission.INVITE_MEMBER,
    Permission.VIEW_VOTING,
    Permission.CREATE_VOTE,
    Permission.CAST_VOTE,
    Permission.MANAGE_VOTING,
    Permission.VIEW_VOTE_RESULTS,
    Permission.VIEW_CBA,
    Permission.EDIT_CBA,
    Permission.CREATE_CBA,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
  ],
  
  [UserRole.STAFF_REP]: [
    // Staff representatives have moderate access
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.CREATE_CLAIM,
    Permission.EDIT_OWN_CLAIMS,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.VIEW_VOTING,
    Permission.CAST_VOTE,
    Permission.VIEW_CBA,
    Permission.VIEW_ANALYTICS,
  ],

  // ========================================================
  // LOCAL UNION EXECUTIVES
  // ========================================================

  [UserRole.PRESIDENT]: [
    // Union President - executive authority
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.CREATE_CLAIM,
    Permission.EDIT_ALL_CLAIMS,
    Permission.APPROVE_CLAIM,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_MEMBER,
    Permission.INVITE_MEMBER,
    Permission.VIEW_VOTING,
    Permission.CREATE_VOTE,
    Permission.CAST_VOTE,
    Permission.MANAGE_VOTING,
    Permission.VIEW_VOTE_RESULTS,
    Permission.VIEW_CBA,
    Permission.EDIT_CBA,
    Permission.CREATE_CBA,
    Permission.SIGN_CBA,
    Permission.VIEW_FINANCIAL,
    Permission.APPROVE_FINANCIAL,
    Permission.APPOINT_COMMITTEES,
    Permission.MANAGE_ELECTIONS,
    Permission.DELEGATE_AUTHORITY,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    Permission.VIEW_ADMIN_PANEL,
    // Correspondence — executives can sign, manage, dispatch
    Permission.VIEW_CORRESPONDENCE,
    Permission.MANAGE_CORRESPONDENCE,
    Permission.SIGN_CORRESPONDENCE,
    Permission.DISPATCH_CORRESPONDENCE,
  ],

  [UserRole.VICE_PRESIDENT]: [
    // Vice President - supports president
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.CREATE_CLAIM,
    Permission.EDIT_ALL_CLAIMS,
    Permission.APPROVE_CLAIM,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_MEMBER,
    Permission.INVITE_MEMBER,
    Permission.VIEW_VOTING,
    Permission.CREATE_VOTE,
    Permission.CAST_VOTE,
    Permission.MANAGE_VOTING,
    Permission.VIEW_VOTE_RESULTS,
    Permission.VIEW_CBA,
    Permission.EDIT_CBA,
    Permission.VIEW_FINANCIAL,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    // Correspondence — VP can sign and manage
    Permission.VIEW_CORRESPONDENCE,
    Permission.MANAGE_CORRESPONDENCE,
    Permission.SIGN_CORRESPONDENCE,
  ],

  [UserRole.SECRETARY_TREASURER]: [
    // Secretary-Treasurer - financial authority
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.CREATE_CLAIM,
    Permission.EDIT_OWN_CLAIMS,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_MEMBER,
    Permission.VIEW_VOTING,
    Permission.CREATE_VOTE,
    Permission.CAST_VOTE,
    Permission.VIEW_VOTE_RESULTS,
    Permission.VIEW_CBA,
    Permission.VIEW_FINANCIAL,
    Permission.EDIT_FINANCIAL,
    Permission.APPROVE_FINANCIAL,
    Permission.MANAGE_FINANCES,
    Permission.AUDIT_FINANCES,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    // Correspondence — secretary-treasurer can sign and dispatch
    Permission.VIEW_CORRESPONDENCE,
    Permission.MANAGE_CORRESPONDENCE,
    Permission.SIGN_CORRESPONDENCE,
    Permission.DISPATCH_CORRESPONDENCE,
  ],

  // ========================================================
  // SENIOR REPRESENTATIVES
  // ========================================================

  [UserRole.CHIEF_STEWARD]: [
    // Chief Steward - claim oversight
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.CREATE_CLAIM,
    Permission.EDIT_ALL_CLAIMS,
    Permission.APPROVE_CLAIM,
    Permission.ASSIGN_CLAIMS,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.VIEW_VOTING,
    Permission.CAST_VOTE,
    Permission.VIEW_CBA,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ADVANCED_ANALYTICS,
    // Correspondence — chief stewards can sign
    Permission.VIEW_CORRESPONDENCE,
    Permission.SIGN_CORRESPONDENCE,
    Permission.MANAGE_CORRESPONDENCE,
  ],

  [UserRole.OFFICER]: [
    // Union Officer - general duties
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.CREATE_CLAIM,
    Permission.EDIT_ALL_CLAIMS,
    Permission.APPROVE_CLAIM,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_MEMBER,
    Permission.INVITE_MEMBER,
    Permission.VIEW_VOTING,
    Permission.CREATE_VOTE,
    Permission.CAST_VOTE,
    Permission.VIEW_VOTE_RESULTS,
    Permission.VIEW_CBA,
    Permission.VIEW_ANALYTICS,
    // Correspondence — officers can review and sign
    Permission.VIEW_CORRESPONDENCE,
    Permission.SIGN_CORRESPONDENCE,
    Permission.MANAGE_CORRESPONDENCE,
  ],

  // ========================================================
  // ADMINISTRATIVE SUPPORT
  // ========================================================

  [UserRole.CLERK]: [
    // Admin Clerk — drafts, prepares, dispatches correspondence
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.VIEW_VOTING,
    Permission.CAST_VOTE,
    Permission.VIEW_CBA,
    Permission.VIEW_ANALYTICS,
    // Correspondence — clerks draft, manage, and dispatch (but do NOT sign)
    Permission.VIEW_CORRESPONDENCE,
    Permission.DRAFT_CORRESPONDENCE,
    Permission.MANAGE_CORRESPONDENCE,
    Permission.DISPATCH_CORRESPONDENCE,
  ],

  // ========================================================
  // FRONT-LINE REPRESENTATIVES
  // ========================================================

  [UserRole.STEWARD]: [
    // Steward - front-line representation
    Permission.VIEW_ALL_CLAIMS,
    Permission.VIEW_OWN_CLAIMS,
    Permission.CREATE_CLAIM,
    Permission.EDIT_ALL_CLAIMS,
    Permission.EDIT_OWN_CLAIMS,
    Permission.ASSIGN_CLAIMS,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.VIEW_VOTING,
    Permission.CAST_VOTE,
    Permission.VIEW_CBA,
    Permission.VIEW_ANALYTICS,
  ],

  [UserRole.BARGAINING_COMMITTEE]: [
    // Bargaining Committee Member - CBA focused
    Permission.VIEW_OWN_CLAIMS,
    Permission.CREATE_CLAIM,
    Permission.EDIT_OWN_CLAIMS,
    Permission.VIEW_ALL_MEMBERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.VIEW_VOTING,
    Permission.CAST_VOTE,
    Permission.VIEW_CBA,
    Permission.EDIT_CBA,
    Permission.CONTRACT_ADMINISTRATION,
    Permission.VIEW_ANALYTICS,
  ],

  // ========================================================
  // SPECIALIZED REPRESENTATIVES
  // ========================================================

  [UserRole.HEALTH_SAFETY_REP]: [
    // Health & Safety Representative
    Permission.VIEW_OWN_CLAIMS,
    Permission.CREATE_CLAIM,
    Permission.EDIT_OWN_CLAIMS,
    Permission.VIEW_HEALTH_SAFETY_CLAIMS,
    Permission.CREATE_HEALTH_SAFETY_CLAIM,
    Permission.MANAGE_HEALTH_SAFETY,
    Permission.VIEW_OWN_PROFILE,
    Permission.VIEW_VOTING,
    Permission.CAST_VOTE,
    Permission.VIEW_CBA,
  ],
  
  [UserRole.MEMBER]: [
    // Members have limited access to their own data
    Permission.VIEW_OWN_CLAIMS,
    Permission.CREATE_CLAIM,
    Permission.EDIT_OWN_CLAIMS,
    Permission.VIEW_OWN_PROFILE,
    Permission.VIEW_VOTING,
    Permission.CAST_VOTE,
    Permission.VIEW_CBA,
  ],
  
  [UserRole.GUEST]: [
    // Guests have minimal read-only access
    Permission.VIEW_OWN_PROFILE,
  ],
};

// Route access control - maps routes to required permissions
export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  "/dashboard": [], // All authenticated users
  "/dashboard/claims": [Permission.VIEW_OWN_CLAIMS],
  "/dashboard/members": [Permission.VIEW_ALL_MEMBERS],
  "/dashboard/voting": [Permission.VIEW_VOTING],
  "/dashboard/collective-agreements": [Permission.VIEW_CBA],
  "/dashboard/analytics": [Permission.VIEW_ANALYTICS],
  "/dashboard/settings": [], // All authenticated users
  
  // Cross-organizational routes (Congress/Federation)
  "/dashboard/cross-union-analytics": [Permission.VIEW_CROSS_UNION_ANALYTICS],
  "/dashboard/precedents": [Permission.VIEW_PRECEDENT_DATABASE],
  "/dashboard/clause-library": [Permission.VIEW_CLAUSE_LIBRARY],
  "/dashboard/organizations": [Permission.VIEW_ALL_ORGANIZATIONS],
  "/dashboard/compliance": [Permission.VIEW_COMPLIANCE_REPORTS],
  "/dashboard/federation": [Permission.VIEW_FEDERATION_ANALYTICS],
  "/dashboard/congress": [Permission.VIEW_CONGRESS_ANALYTICS],
  
  "/admin": [Permission.VIEW_ADMIN_PANEL],
  "/admin/claims": [Permission.VIEW_ALL_CLAIMS, Permission.VIEW_ADMIN_PANEL],
  "/admin/members": [Permission.MANAGE_USERS, Permission.VIEW_ADMIN_PANEL],
  "/admin/voting": [Permission.MANAGE_VOTING, Permission.VIEW_ADMIN_PANEL],
  "/admin/analytics": [Permission.VIEW_ADVANCED_ANALYTICS, Permission.VIEW_ADMIN_PANEL],
  "/admin/settings": [Permission.SYSTEM_SETTINGS, Permission.VIEW_ADMIN_PANEL],
  "/admin/organizations": [Permission.MANAGE_ORGANIZATIONS, Permission.VIEW_ADMIN_PANEL],
};

// Navigation items with required permissions
export interface NavItem {
  href: string;
  label: string;
  icon: string;
  requiredPermissions: Permission[];
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "Home",
    requiredPermissions: [],
  },
  {
    href: "/dashboard/claims",
    label: "My Claims",
    icon: "FileText",
    requiredPermissions: [Permission.VIEW_OWN_CLAIMS],
  },
  {
    href: "/dashboard/collective-agreements",
    label: "Collective Agreements",
    icon: "BookOpen",
    requiredPermissions: [Permission.VIEW_CBA],
  },
  {
    href: "/dashboard/voting",
    label: "Voting",
    icon: "Vote",
    requiredPermissions: [Permission.VIEW_VOTING],
  },
  {
    href: "/dashboard/members",
    label: "Members",
    icon: "Users",
    requiredPermissions: [Permission.VIEW_ALL_MEMBERS],
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: "TrendingUp",
    requiredPermissions: [Permission.VIEW_ANALYTICS],
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: "Settings",
    requiredPermissions: [],
  },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    href: "/admin",
    label: "Overview",
    icon: "LayoutDashboard",
    requiredPermissions: [Permission.VIEW_ADMIN_PANEL],
    adminOnly: true,
  },
  {
    href: "/admin/claims",
    label: "Claims Management",
    icon: "FileText",
    requiredPermissions: [Permission.VIEW_ALL_CLAIMS, Permission.VIEW_ADMIN_PANEL],
    adminOnly: true,
  },
  {
    href: "/admin/members",
    label: "Members",
    icon: "Users",
    requiredPermissions: [Permission.MANAGE_USERS, Permission.VIEW_ADMIN_PANEL],
    adminOnly: true,
  },
  {
    href: "/admin/voting",
    label: "Voting Admin",
    icon: "Vote",
    requiredPermissions: [Permission.MANAGE_VOTING, Permission.VIEW_ADMIN_PANEL],
    adminOnly: true,
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: "TrendingUp",
    requiredPermissions: [Permission.VIEW_ADVANCED_ANALYTICS, Permission.VIEW_ADMIN_PANEL],
    adminOnly: true,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: "Settings",
    requiredPermissions: [Permission.SYSTEM_SETTINGS, Permission.VIEW_ADMIN_PANEL],
    adminOnly: true,
  },
];

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has any of the required permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  if (permissions.length === 0) return true; // No permissions required
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a role has all required permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  if (permissions.length === 0) return true; // No permissions required
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Check if a role can access a specific route
 */
export function canAccessRoute(role: UserRole, route: string): boolean {
  const requiredPermissions = ROUTE_PERMISSIONS[route];
  if (!requiredPermissions) return true; // Route not defined, allow access
  return hasAllPermissions(role, requiredPermissions);
}

/**
 * Get filtered navigation items based on user role
 */
export function getAccessibleNavItems(role: UserRole, adminMode: boolean = false): NavItem[] {
  const items = adminMode ? ADMIN_NAV_ITEMS : NAV_ITEMS;
  return items.filter(item => hasAllPermissions(role, item.requiredPermissions));
}

/**
 * Get role hierarchy level (higher number = more permissions)
 * 
 * Role Hierarchy:
 * 200: SYSTEM_ADMIN (CLC IT / System operators)
 * 190: CLC_EXECUTIVE (CLC President, Secretary-Treasurer)
 * 180: CLC_STAFF (CLC national staff)
 * 170: FED_EXECUTIVE (Federation President, VP)
 * 160: FED_STAFF (Provincial federation staff)
 * 150: NATIONAL_OFFICER (National union officers)
 * 140-100: Local union executives (ADMIN, PRESIDENT, VP, SECRETARY_TREASURER)
 * 90-60: Senior representatives (CHIEF_STEWARD, OFFICER)
 * 50-40: Front-line representatives (STEWARD, BARGAINING_COMMITTEE)
 * 30: Specialized representatives (HEALTH_SAFETY_REP)
 * 20-10: Base membership (MEMBER)
 * 0: GUEST
 * 
 * Legacy roles map to their equivalent new roles
 */
export function getRoleLevel(role: UserRole): number {
  const levels: Record<UserRole, number> = {
    // Nzila platform operations (highest tier)
    [UserRole.APP_OWNER]: 250,
    [UserRole.COO]: 240,
    [UserRole.CTO]: 235,
    [UserRole.PLATFORM_LEAD]: 220,
    [UserRole.CUSTOMER_SUCCESS_DIRECTOR]: 215,
    [UserRole.SECURITY_MANAGER]: 212,
    [UserRole.COMPLIANCE_MANAGER]: 211,
    [UserRole.SUPPORT_MANAGER]: 210,
    [UserRole.DATA_ANALYTICS_MANAGER]: 208,
    [UserRole.BILLING_MANAGER]: 206,
    [UserRole.INTEGRATION_MANAGER]: 204,
    [UserRole.CONTENT_MANAGER]: 202,
    [UserRole.TRAINING_COORDINATOR]: 201,
    [UserRole.SUPPORT_AGENT]: 195,
    [UserRole.DATA_ANALYST]: 193,
    [UserRole.BILLING_SPECIALIST]: 191,
    [UserRole.INTEGRATION_SPECIALIST]: 190,
    // System administration
    [UserRole.SYSTEM_ADMIN]: 200,
    // CLC / Federation / National
    [UserRole.CLC_EXECUTIVE]: 190,
    [UserRole.CLC_STAFF]: 180,
    [UserRole.FED_EXECUTIVE]: 170,
    [UserRole.FED_STAFF]: 160,
    [UserRole.NATIONAL_OFFICER]: 150,
    // Local union leadership
    [UserRole.ADMIN]: 140,
    [UserRole.PRESIDENT]: 130,
    [UserRole.VICE_PRESIDENT]: 120,
    [UserRole.SECRETARY_TREASURER]: 110,
    // Representatives
    [UserRole.CHIEF_STEWARD]: 90,
    [UserRole.OFFICER]: 80,
    // Administrative support
    [UserRole.CLERK]: 70,
    [UserRole.STEWARD]: 50,
    [UserRole.BARGAINING_COMMITTEE]: 40,
    [UserRole.HEALTH_SAFETY_REP]: 30,
    // Base membership
    [UserRole.MEMBER]: 20,
    // Legacy roles
    [UserRole.CONGRESS_STAFF]: 180,      // Maps to CLC_STAFF
    [UserRole.FEDERATION_STAFF]: 160,    // Maps to FED_STAFF
    [UserRole.UNION_REP]: 50,            // Maps to STEWARD
    [UserRole.STAFF_REP]: 50,            // Maps to STEWARD
    [UserRole.GUEST]: 0,
  };
  return levels[role] ?? 0;
}

/**
 * Check if role1 has higher or equal privilege than role2
 */
export function hasHigherOrEqualRole(role1: UserRole, role2: UserRole): boolean {
  return getRoleLevel(role1) >= getRoleLevel(role2);
}

