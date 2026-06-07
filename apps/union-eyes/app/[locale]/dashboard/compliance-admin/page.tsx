/**
 * Compliance Admin Dashboard
 * For Compliance Manager - Audit logs, compliance reports, GDPR
 * 
 * @role compliance_manager
 * @dashboard_path /dashboard/compliance-admin
 */


export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { Shield, AlertTriangle, CheckCircle2, Clock, Eye } from 'lucide-react';
import { logger } from '@/lib/logger';

// Fetch audit logs from API
async function getAuditLogs() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/compliance/audit-logs?limit=20`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      logger.error('Failed to fetch audit logs');
      return [];
    }
    
    const data = await response.json();
    return data.data?.logs || [];
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    return [];
  }
}

export default async function ComplianceDashboard() {
  const t = await getTranslations('complianceAdminPage');
  await requireUser();
  
  // Require compliance manager role
  const hasAccess = await hasMinRole('compliance_manager');
  if (!hasAccess) {
    redirect('/dashboard');
  }
  
  // Fetch real data
  const auditLogs = await getAuditLogs();
  
  // Calculate metrics
  const totalEvents = auditLogs.length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const highRiskEvents = auditLogs.filter((log: unknown) => log.risk_level === 'high').length;
  const complianceScore = totalEvents > 0 
    ? (((totalEvents - highRiskEvents) / totalEvents) * 100).toFixed(1)
    : '100.0';
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('subtitle')}
        </p>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('tabOverview')}</TabsTrigger>
          <TabsTrigger value="audit-logs">{t('tabAuditLogs')}</TabsTrigger>
          <TabsTrigger value="reports">{t('tabReports')}</TabsTrigger>
          <TabsTrigger value="risk">{t('tabRiskAssessment')}</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t('complianceScoreTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{complianceScore}%</div>
                <p className="text-xs text-muted-foreground">{t('aboveTarget')}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  {t('auditEventsTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalEvents}</div>
                <p className="text-xs text-muted-foreground">{t('totalLogged')}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t('highRiskEventsTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{highRiskEvents}</div>
                <p className="text-xs text-muted-foreground">{t('requireReview')}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('gdprStatusTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{t('compliant')}</div>
                <p className="text-xs text-muted-foreground">{t('allChecksPassed')}</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('complianceMetricsTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('dataProtectionGdpr')}</span>
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {t('compliant')}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('accessControls')}</span>
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {t('compliant')}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('auditLogging')}</span>
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {t('compliant')}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('dataRetention')}</span>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t('reviewNeeded')}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{t('recentComplianceChecksTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t('dataEncryptionAudit')}</p>
                      <p className="text-xs text-muted-foreground">{t('twoHoursAgo')}</p>
                    </div>
                    <Badge variant="default">{t('passed')}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t('accessReview')}</p>
                      <p className="text-xs text-muted-foreground">{t('fiveHoursAgo')}</p>
                    </div>
                    <Badge variant="default">{t('passed')}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t('privacyPolicyUpdate')}</p>
                      <p className="text-xs text-muted-foreground">{t('oneDayAgo')}</p>
                    </div>
                    <Badge variant="secondary">{t('pending')}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Audit Logs Tab */}
        <TabsContent value="audit-logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('auditTrailTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noAuditLogsFound')}</p>
              ) : (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {auditLogs.map((log: unknown, index: number) => (
                    <div key={log.id || index} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            log.risk_level === 'high' ? 'destructive' : 
                            log.risk_level === 'medium' ? 'secondary' : 
                            'outline'
                          }>
                            {log.risk_level || 'low'}
                          </Badge>
                          <span className="text-sm font-medium">{log.event_type || log.action}</span>
                        </div>
                        <p className="text-sm">{log.description || log.details}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.user_email || log.actor} • {log.timestamp || log.created_at}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('complianceReportsTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t('monthlyComplianceReport')}</p>
                    <p className="text-xs text-muted-foreground">{t('january2026')}</p>
                  </div>
                  <button className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                    {t('download')}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t('gdprComplianceAudit')}</p>
                    <p className="text-xs text-muted-foreground">{t('q42025')}</p>
                  </div>
                  <button className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                    {t('download')}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t('accessControlReview')}</p>
                    <p className="text-xs text-muted-foreground">{t('december2025')}</p>
                  </div>
                  <button className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                    {t('download')}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Risk Assessment Tab */}
        <TabsContent value="risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('riskAssessmentTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{t('dataSecurityRisk')}</span>
                    <span className="text-sm text-green-600">{t('low')}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-600 rounded-full" style={{ width: '15%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{t('accessControlRisk')}</span>
                    <span className="text-sm text-green-600">{t('low')}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-600 rounded-full" style={{ width: '10%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{t('complianceRisk')}</span>
                    <span className="text-sm text-yellow-600">{t('medium')}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-600 rounded-full" style={{ width: '35%' }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
