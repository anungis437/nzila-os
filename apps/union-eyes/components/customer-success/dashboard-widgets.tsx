/**
 * Customer Success Dashboard Widgets
 * Driven by real organization data passed from the Customer Success page.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
 
import { 
  Heart, 
  Users, 
  TrendingDown, 
  Zap, 
  ThumbsUp, 
  MessageSquare,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export interface OrgData {
  id: string;
  name: string;
  organizationType: string;
  status: string;
  memberCount: number;
  activeMemberCount: number;
  sectors: string[];
  clcAffiliated: boolean;
  subscriptionTier: string | null;
  perCapitaRate: string | null;
  createdAt: string;
}

interface WidgetProps {
  detailed?: boolean;
  organizations?: OrgData[];
}

export function CustomerHealthScoresWidget({ detailed: _detailed = false, organizations = [] }: WidgetProps) {
  const customers = organizations.map(org => {
    const healthScore = org.status === 'active' 
      ? Math.min(100, 60 + (org.activeMemberCount > 0 ? 20 : 0) + (org.clcAffiliated ? 10 : 0) + (org.sectors.length > 0 ? 10 : 0))
      : 30;
    return {
      name: org.name,
      health: healthScore,
      status: healthScore >= 70 ? 'healthy' : 'at-risk',
      users: org.memberCount,
    };
  });
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5" />
          Customer Health Scores
        </CardTitle>
        <CardDescription>Overall customer health by organization</CardDescription>
      </CardHeader>
      <CardContent>
        {customers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No organizations found</p>
        ) : (
          <div className="space-y-4">
            {customers.map((customer) => (
              <div key={customer.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{customer.users.toLocaleString()} members</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{customer.health}%</span>
                    {customer.status === 'healthy' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                    )}
                  </div>
                </div>
                <Progress value={customer.health} className="h-2" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OnboardingProgressWidget({ detailed: _detailed = false, organizations = [] }: WidgetProps) {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const onboardingCustomers = organizations.map(org => {
    const daysSinceCreation = org.createdAt 
      ? Math.floor((now - new Date(org.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const hasMembers = org.memberCount > 0;
    const hasSectors = org.sectors.length > 0;
    const hasSubscription = !!org.subscriptionTier;
    const progress = 25 + (hasMembers ? 25 : 0) + (hasSectors ? 25 : 0) + (hasSubscription ? 25 : 0);
    const stage = progress >= 100 ? 'Complete' : progress >= 75 ? 'Training' : progress >= 50 ? 'Setup' : 'Onboarding';
    
    return { name: org.name, stage, progress, daysActive: daysSinceCreation };
  });
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Onboarding Progress
        </CardTitle>
        <CardDescription>Customer activation status</CardDescription>
      </CardHeader>
      <CardContent>
        {onboardingCustomers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No organizations found</p>
        ) : (
          <div className="space-y-4">
            {onboardingCustomers.map((customer) => (
              <div key={customer.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {customer.stage} • Day {customer.daysActive}
                    </p>
                  </div>
                  <span className="text-sm font-bold">{customer.progress}%</span>
                </div>
                <Progress value={customer.progress} className="h-2" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ChurnRiskWidget({ detailed: _detailed = false, organizations = [] }: WidgetProps) {
  const atRiskCustomers = organizations
    .filter(org => org.status !== 'active' || org.activeMemberCount === 0)
    .map(org => ({
      name: org.name,
      risk: org.status !== 'active' ? 'high' : 'medium',
      reason: org.status !== 'active' ? `Status: ${org.status}` : 'No active members',
      lastLogin: org.status !== 'active' ? 'Account inactive' : 'N/A',
    }));
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Churn Risk Analysis
        </CardTitle>
        <CardDescription>Customers requiring attention</CardDescription>
      </CardHeader>
      <CardContent>
        {atRiskCustomers.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">All customers are healthy — no churn risks detected</p>
          </div>
        ) : (
          <div className="space-y-3">
            {atRiskCustomers.map((customer) => (
              <div key={customer.name} className="flex items-start justify-between border-b pb-2 last:border-0">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">{customer.reason}</p>
                </div>
                <Badge variant={customer.risk === 'high' ? 'destructive' : 'secondary'}>
                  {customer.risk} risk
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface GrievanceData {
  total: number;
  open: number;
  resolved: number;
  highPriority: number;
  inArbitration: number;
}

interface CBAData {
  total: number;
  active: number;
  negotiating: number;
  expired: number;
}

interface AdoptionWidgetProps {
  detailed?: boolean;
  grievances?: GrievanceData;
  collectiveAgreements?: CBAData;
}

export function AdoptionMetricsWidget({ detailed: _detailed = false, grievances, collectiveAgreements }: AdoptionWidgetProps) {
  const totalGrievances = grievances?.total ?? 0;
  const totalCBAs = collectiveAgreements?.total ?? 0;
  
  const features = [
    { name: 'Grievance Management', adoption: totalGrievances > 0 ? Math.min(100, Math.round((grievances?.resolved ?? 0) / totalGrievances * 100)) : 0, trend: 'active' },
    { name: 'CBA Library', adoption: totalCBAs > 0 ? Math.min(100, Math.round((collectiveAgreements?.active ?? 0) / totalCBAs * 100)) : 0, trend: 'active' },
    { name: 'Bargaining Module', adoption: collectiveAgreements?.negotiating ?? 0 > 0 ? 100 : 0, trend: (collectiveAgreements?.negotiating ?? 0) > 0 ? 'active' : 'inactive' },
    { name: 'Arbitration Pipeline', adoption: grievances?.inArbitration ?? 0 > 0 ? 100 : 0, trend: (grievances?.inArbitration ?? 0) > 0 ? 'active' : 'inactive' },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Feature Adoption
        </CardTitle>
        <CardDescription>Module usage across the platform</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {features.map((feature) => (
            <div key={feature.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{feature.name}</p>
                <span className="text-sm font-bold">{feature.adoption > 0 ? `${feature.adoption}%` : 'N/A'}</span>
              </div>
              <Progress value={feature.adoption} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface NPSWidgetProps {
  detailed?: boolean;
  organizations?: OrgData[];
}

export function NPSWidget({ detailed: _detailed = false, organizations = [] }: NPSWidgetProps) {
  const totalOrgs = organizations.length;
  const activeOrgs = organizations.filter(o => o.status === 'active').length;
  const affiliatedOrgs = organizations.filter(o => o.clcAffiliated).length;
  // Compute a platform health score based on org status
  const healthScore = totalOrgs > 0 ? Math.round((activeOrgs / totalOrgs) * 100) : 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ThumbsUp className="h-5 w-5" />
          Platform Health Score
        </CardTitle>
        <CardDescription>Organization health metric</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl font-bold">{healthScore}</div>
            <p className="text-sm text-muted-foreground">
              {healthScore >= 90 ? 'Excellent' : healthScore >= 70 ? 'Good' : healthScore >= 50 ? 'Fair' : 'Needs attention'}
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600">Active Organizations</span>
              <span className="font-medium">{activeOrgs} / {totalOrgs}</span>
            </div>
            <Progress value={totalOrgs > 0 ? (activeOrgs / totalOrgs) * 100 : 0} className="h-2 [&>div]:bg-green-600" />
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-600">CLC Affiliated</span>
              <span className="font-medium">{affiliatedOrgs} / {totalOrgs}</span>
            </div>
            <Progress value={totalOrgs > 0 ? (affiliatedOrgs / totalOrgs) * 100 : 0} className="h-2 [&>div]:bg-blue-600" />
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            Based on {totalOrgs} organizations
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface FeedbackWidgetProps {
  detailed?: boolean;
  organizations?: OrgData[];
  settlements?: { total: number; totalMonetaryValue: number };
}

export function CustomerFeedbackWidget({ detailed: _detailed = false, organizations = [], settlements }: FeedbackWidgetProps) {
  // Show real organizational activity as "feedback"
  const activity = organizations.map(org => ({
    customer: org.name,
    type: org.organizationType,
    members: org.memberCount,
    sectors: org.sectors.join(', ') || 'No sector assigned',
    status: org.status,
  }));
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Organization Activity
        </CardTitle>
        <CardDescription>Customer organization overview</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organization data available</p>
          ) : (
            activity.map((item) => (
              <div key={item.customer} className="border-b pb-2 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{item.customer}</p>
                  <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>{item.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground capitalize">{item.type} • {item.members.toLocaleString()} members</p>
                <p className="text-xs text-muted-foreground mt-1">{item.sectors}</p>
              </div>
            ))
          )}
          {settlements && settlements.total > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                {settlements.total} settlement{settlements.total !== 1 ? 's' : ''} totaling ${settlements.totalMonetaryValue.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
