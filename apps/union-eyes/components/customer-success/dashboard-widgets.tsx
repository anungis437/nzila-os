/**
 * Customer Success Dashboard Widgets
 * Placeholder components for customer health and retention monitoring
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

interface WidgetProps {
  detailed?: boolean;
}

export function CustomerHealthScoresWidget({ detailed: _detailed = false }: WidgetProps) {
  const customers = [
    { name: 'Unifor Local 1', health: 92, status: 'healthy', users: 450 },
    { name: 'CUPE Local 416', health: 85, status: 'healthy', users: 320 },
    { name: 'OPSEU Local 562', health: 68, status: 'at-risk', users: 180 },
    { name: 'CWA Local 1', health: 95, status: 'healthy', users: 520 },
  ];
  
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
        <div className="space-y-4">
          {customers.map((customer) => (
            <div key={customer.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">{customer.users} users</p>
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
      </CardContent>
    </Card>
  );
}

export function OnboardingProgressWidget({ detailed: _detailed = false }: WidgetProps) {
  const onboardingCustomers = [
    { name: 'IBEW Local 353', stage: 'Setup', progress: 75, daysActive: 5 },
    { name: 'Teamsters Local 141', stage: 'Training', progress: 45, daysActive: 3 },
    { name: 'UAW Local 27', stage: 'Launch', progress: 90, daysActive: 12 },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Onboarding Progress
        </CardTitle>
        <CardDescription>New customer activation status</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

export function ChurnRiskWidget({ detailed: _detailed = false }: WidgetProps) {
  const atRiskCustomers = [
    { name: 'SEIU Local 87', risk: 'high', reason: 'Low usage last 30d', lastLogin: '15 days ago' },
    { name: 'AFSCME Local 3299', risk: 'medium', reason: 'Support tickets increasing', lastLogin: '2 days ago' },
    { name: 'UFCW Local 1518', risk: 'medium', reason: 'No admin activity', lastLogin: '8 days ago' },
  ];
  
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
        <div className="space-y-3">
          {atRiskCustomers.map((customer) => (
            <div key={customer.name} className="flex items-start justify-between border-b pb-2 last:border-0">
              <div className="space-y-1">
                <p className="text-sm font-medium">{customer.name}</p>
                <p className="text-xs text-muted-foreground">{customer.reason}</p>
                <p className="text-xs text-muted-foreground">Last login: {customer.lastLogin}</p>
              </div>
              <Badge variant={customer.risk === 'high' ? 'destructive' : 'secondary'}>
                {customer.risk} risk
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdoptionMetricsWidget({ detailed: _detailed = false }: WidgetProps) {
  const features = [
    { name: 'Claims Management', adoption: 87, trend: 'up' },
    { name: 'CBA Library', adoption: 72, trend: 'up' },
    { name: 'Bargaining Module', adoption: 45, trend: 'stable' },
    { name: 'Health & Safety', adoption: 38, trend: 'down' },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Feature Adoption
        </CardTitle>
        <CardDescription>Module usage across customers</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {features.map((feature) => (
            <div key={feature.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{feature.name}</p>
                <span className="text-sm font-bold">{feature.adoption}%</span>
              </div>
              <Progress value={feature.adoption} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function NPSWidget({ detailed: _detailed = false }: WidgetProps) {
  const npsData = {
    score: 72,
    promoters: 65,
    passives: 28,
    detractors: 7,
    responses: 156,
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ThumbsUp className="h-5 w-5" />
          Net Promoter Score
        </CardTitle>
        <CardDescription>Customer satisfaction metric</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl font-bold">{npsData.score}</div>
            <p className="text-sm text-muted-foreground">World-class (70+)</p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600">Promoters (9-10)</span>
              <span className="font-medium">{npsData.promoters}%</span>
            </div>
            <Progress value={npsData.promoters} className="h-2 [&>div]:bg-green-600" />
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-yellow-600">Passives (7-8)</span>
              <span className="font-medium">{npsData.passives}%</span>
            </div>
            <Progress value={npsData.passives} className="h-2 [&>div]:bg-yellow-600" />
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-red-600">Detractors (0-6)</span>
              <span className="font-medium">{npsData.detractors}%</span>
            </div>
            <Progress value={npsData.detractors} className="h-2 [&>div]:bg-red-600" />
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            Based on {npsData.responses} responses
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CustomerFeedbackWidget({ detailed: _detailed = false }: WidgetProps) {
  const feedback = [
    { customer: 'Unifor Local 1', rating: 5, comment: 'Excellent claims tracking!', date: '2 hours ago' },
    { customer: 'CUPE Local 416', rating: 4, comment: 'Good but needs better mobile app', date: '5 hours ago' },
    { customer: 'UAW Local 27', rating: 5, comment: 'Love the bargaining module', date: '1 day ago' },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Recent Feedback
        </CardTitle>
        <CardDescription>Latest customer comments</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {feedback.map((item, index) => (
            <div key={index} className="border-b pb-2 last:border-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">{item.customer}</p>
                <div className="flex items-center gap-1">
                  {[...Array(item.rating)].map((_, i) => (
                    <span key={i} className="text-yellow-500">⭐</span>
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{item.comment}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.date}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
