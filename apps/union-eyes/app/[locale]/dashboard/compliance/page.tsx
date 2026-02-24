export const dynamic = 'force-dynamic';

import { FileBarChart, AlertCircle, CheckCircle2, Clock } from "lucide-react";

export default function CompliancePage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileBarChart className="w-8 h-8" />
            Compliance Reports
          </h1>
          <p className="text-muted-foreground mt-1">
            Charter, constitution, and bylaw compliance tracking across affiliates
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Affiliates</p>
              <p className="text-2xl font-bold">--</p>
            </div>
            <FileBarChart className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Compliant</p>
              <p className="text-2xl font-bold text-green-600">--</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Needs Attention</p>
              <p className="text-2xl font-bold text-yellow-600">--</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Non-Compliant</p>
              <p className="text-2xl font-bold text-red-600">--</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Compliance Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-semibold mb-4">Charter Compliance</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded">
              <span>Elections & Democracy</span>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded">
              <span>Financial Reporting</span>
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded">
              <span>Member Rights</span>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-semibold mb-4">Reporting Deadlines</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded">
              <div>
                <p className="font-medium">Annual Financial Report</p>
                <p className="text-sm text-muted-foreground">Due: March 31</p>
              </div>
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded">
              <div>
                <p className="font-medium">Election Results</p>
                <p className="text-sm text-muted-foreground">Due: Within 30 days</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded">
              <div>
                <p className="font-medium">Constitution Updates</p>
                <p className="text-sm text-muted-foreground">As needed</p>
              </div>
              <AlertCircle className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/50">
        <FileBarChart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-xl font-semibold mb-2">Compliance Tracking Dashboard</h3>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Full compliance tracking features coming soon. This will include automated reporting,
          deadline notifications, document management, and detailed compliance audit trails
          for all affiliate organizations.
        </p>
      </div>
    </div>
  );
}
