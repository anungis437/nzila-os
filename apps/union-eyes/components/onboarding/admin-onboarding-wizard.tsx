/**
 * Admin Onboarding Wizard
 * 
 * Multi-step onboarding flow for new organization administrators:
 * - Step 1: System Overview & Permissions
 * - Step 2: User Management
 * - Step 3: Security & Compliance
 * - Step 4: Integrations & Settings
 * - Step 5: Reporting & Analytics
 * 
 * @module components/onboarding/admin-onboarding-wizard
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
 
import {
  Settings,
  Users,
  Shield,
  Plug,
  BarChart3,
  Key as _Key,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { logger } from "@/lib/logger";

export interface AdminOnboardingData {
  adminLevel: string;
  departments: string[];
  hasAuditAccess: boolean;
  hasBillingAccess: boolean;
  completedSteps: number;
}

const STEPS = [
  {
    id: "overview",
    title: "System Overview",
    description: "Understanding admin capabilities",
    icon: Settings,
  },
  {
    id: "users",
    title: "User Management",
    description: "Managing roles and permissions",
    icon: Users,
  },
  {
    id: "security",
    title: "Security & Compliance",
    description: "Protecting your organization",
    icon: Shield,
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connecting external systems",
    icon: Plug,
  },
  {
    id: "reporting",
    title: "Reporting",
    description: "Using analytics effectively",
    icon: BarChart3,
  },
];

export function AdminOnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [data, setData] = React.useState<AdminOnboardingData>({
    adminLevel: "standard",
    departments: [],
    hasAuditAccess: false,
    hasBillingAccess: false,
    completedSteps: 0,
  });

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      setData({ ...data, completedSteps: currentStep + 1 });
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    logger.info("Admin onboarding completed", { data });
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_onboarding_completed', new Date().toISOString());
    }
    router.push('/admin');
  };

  const handleSkip = () => {
    router.push('/admin');
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
          <Settings className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Administrator Onboarding
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Welcome to your admin role. Let&apos;s configure your organization.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Step {currentStep + 1} of {STEPS.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Content */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            {React.createElement(STEPS[currentStep].icon, { 
              className: "w-6 h-6 text-red-600" 
            })}
            <div>
              <CardTitle>{STEPS[currentStep].title}</CardTitle>
              <CardDescription>{STEPS[currentStep].description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentStep === 0 && <OverviewStep data={data} setData={setData} />}
          {currentStep === 1 && <UsersStep />}
          {currentStep === 2 && <SecurityStep data={data} setData={setData} />}
          {currentStep === 3 && <IntegrationsStep />}
          {currentStep === 4 && <ReportingStep />}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleSkip}>
          Skip for Now
        </Button>
        <div className="flex gap-3">
          {currentStep > 0 && (
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          <Button onClick={handleNext}>
            {currentStep === STEPS.length - 1 ? (
              <>Complete Onboarding</>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OverviewStep({ 
  data, 
  setData 
}: { 
  data: AdminOnboardingData; 
  setData: React.Dispatch<React.SetStateAction<AdminOnboardingData>>;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-red-50 rounded-lg p-4">
        <h3 className="font-semibold text-red-900 mb-2">Admin Capabilities</h3>
        <p className="text-red-800 text-sm">
          As an administrator, you have powerful tools to manage your organization. 
          With great power comes great responsibility!
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Your Admin Powers</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { title: "User Management", desc: "Add, remove, modify users" },
            { title: "Role Assignment", desc: "Set permissions levels" },
            { title: "Organization Settings", desc: "Configure branding, preferences" },
            { title: "Audit Logs", desc: "View all system activity" },
            { title: "Billing Access", desc: "Manage subscriptions" },
            { title: "Data Export", desc: "Download organization data" }
          ].map((item, index) => (
            <div key={index} className="border rounded-lg p-3">
              <h5 className="font-medium text-sm flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-500" />
                {item.title}
              </h5>
              <p className="text-xs text-gray-600 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Admin Level</label>
        <select 
          className="w-full p-2 border rounded-md"
          value={data.adminLevel}
          onChange={(e) => setData({ ...data, adminLevel: e.target.value })}
        >
          <option value="standard">Standard Admin</option>
          <option value="super">Super Admin</option>
          <option value="billing">Billing Admin</option>
          <option value="auditor">Auditor (Read-only)</option>
        </select>
      </div>
    </div>
  );
}

function UsersStep() {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">👥 User Management</h3>
        <p className="text-blue-800 text-sm">
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          Manage your organization's users and their access levels efficiently.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">User Roles in UnionEyes</h4>
        <div className="space-y-2">
          {[
            { role: "Member", access: "Basic access, view own data" },
            { role: "Steward", access: "Manage grievances, member data" },
            { role: "Officer", access: "Voting, reports, communications" },
            { role: "Admin", access: "Full organization control" },
            { role: "System Admin", access: "Technical administration" }
          ].map((item, index) => (
            <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <span className="font-medium text-sm">{item.role}</span>
              <span className="text-xs text-gray-500">{item.access}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
        <h4 className="font-medium text-yellow-900 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Best Practices
        </h4>
        <ul className="text-yellow-800 text-sm space-y-1">
          <li>• Follow principle of least privilege</li>
          <li>• Audit user access regularly</li>
          <li>• Remove inactive users promptly</li>
          <li>• Use role groups for批量 assignment</li>
        </ul>
      </div>
    </div>
  );
}

function SecurityStep({ 
  data, 
  setData 
}: { 
  data: AdminOnboardingData; 
  setData: React.Dispatch<React.SetStateAction<AdminOnboardingData>>;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
        <h3 className="font-semibold text-green-900 mb-2">🔒 Security & Compliance</h3>
        <p className="text-green-800 text-sm">
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          Protect your organization's data and maintain compliance with privacy regulations.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Security Features</h4>
        <div className="space-y-2">
          {[
            { title: "Two-Factor Authentication", desc: "Enforce 2FA for all users" },
            { title: "Single Sign-On (SSO)", desc: "Integrate with existing identity providers" },
            { title: "Audit Logging", desc: "Track all admin actions" },
            { title: "Data Encryption", desc: "All data encrypted at rest and in transit" },
            { title: "Session Management", desc: "Configure session timeouts" },
            { title: "IP Allowlisting", desc: "Restrict access by IP address" }
          ].map((item, index) => (
            <div key={index} className="flex items-start gap-2 text-sm">
              <Shield className="w-4 h-4 text-green-500 mt-0.5" />
              <div>
                <span className="font-medium">{item.title}</span>
                <span className="text-gray-500"> - {item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Your Security Settings</h4>
        <label className="flex items-center gap-2 text-sm">
          <input 
            type="checkbox" 
            checked={data.hasAuditAccess}
            onChange={(e) => setData({ ...data, hasAuditAccess: e.target.checked })}
            className="rounded"
          />
          I need access to audit logs
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input 
            type="checkbox" 
            checked={data.hasBillingAccess}
            onChange={(e) => setData({ ...data, hasBillingAccess: e.target.checked })}
            className="rounded"
          />
          I need billing access
        </label>
      </div>

      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
        <h4 className="font-medium text-red-900 mb-2">Compliance Requirements</h4>
        <ul className="text-red-800 text-sm space-y-1">
          <li>• PIPEDA compliance for member data</li>
          <li>• Quebec privacy law (LPRPDE) if applicable</li>
          <li>• Retain audit logs for minimum 7 years</li>
          <li>• Report security incidents within 72 hours</li>
        </ul>
      </div>
    </div>
  );
}

function IntegrationsStep() {
  return (
    <div className="space-y-6">
      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
        <h3 className="font-semibold text-purple-900 mb-2">🔌 Integrations</h3>
        <p className="text-purple-800 text-sm">
          Connect UnionEyes with your existing tools and services.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Available Integrations</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: "Google Workspace", status: "Available", desc: "Calendar, email sync" },
            { name: "Microsoft 365", status: "Available", desc: "Outlook, Teams integration" },
            { name: "Slack", status: "Available", desc: "Notifications to channels" },
            { name: "HRIS Systems", status: "Available", desc: "Workday, BambooHR" },
            { name: "Accounting", status: "Available", desc: "QuickBooks, Xero sync" },
            { name: "Payment Processors", status: "Available", desc: "Stripe, PayPal" }
          ].map((item, index) => (
            <div key={index} className="border rounded-lg p-3">
              <div className="flex justify-between items-start">
                <h5 className="font-medium text-sm">{item.name}</h5>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  item.status === "Available" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}>
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">💡 Getting Started</h4>
        <p className="text-blue-800 text-sm">
          Start with the Calendar sync to keep members informed about meetings and events. 
          Then add your communication tools for targeted messaging.
        </p>
      </div>
    </div>
  );
}

function ReportingStep() {
  return (
    <div className="space-y-6">
      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
        <h3 className="font-semibold text-green-900 mb-2">📊 Reporting & Analytics</h3>
        <p className="text-green-800 text-sm">
          Make data-driven decisions with powerful analytics tools.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Key Reports</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { title: "Membership Analytics", desc: "Growth, retention, demographics" },
            { title: "Grievance Metrics", desc: "Trends, resolution times, outcomes" },
            { title: "Financial Reports", desc: "Revenue, expenses, forecasts" },
            { title: "Engagement Scores", desc: "Member participation metrics" }
          ].map((item, index) => (
            <div key={index} className="border rounded-lg p-3">
              <h5 className="font-medium text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                {item.title}
              </h5>
              <p className="text-xs text-gray-600 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Scheduled Reports</h4>
        <p className="text-sm text-gray-600">
          You can schedule reports to run automatically and be emailed to stakeholders.
        </p>
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <p><strong>Common schedules:</strong></p>
          <ul className="mt-2 space-y-1 text-gray-600">
            <li>• Monthly membership report → Executive board</li>
            <li>• Quarterly financial report → Finance committee</li>
            <li>• Weekly grievance summary → Chief steward</li>
          </ul>
        </div>
      </div>

      <div className="text-center p-4 bg-green-100 rounded-lg">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
        <h4 className="font-medium text-green-900">You&apos;re All Set!</h4>
        <p className="text-green-800 text-sm">
          Complete onboarding to access your admin dashboard.
        </p>
      </div>
    </div>
  );
}

export default AdminOnboardingWizard;
