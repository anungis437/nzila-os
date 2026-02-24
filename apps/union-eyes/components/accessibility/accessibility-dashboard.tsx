/**
 * Accessibility Dashboard Component
 * 
 * WCAG 2.2 AA compliance monitoring
 * Issue tracking and remediation workflow
 * Accessibility score visualization
 */

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  Play,
  FileText,
  TrendingUp,
  TrendingDown,
  Eye,
  Keyboard,
  Palette,
} from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

interface AccessibilityAudit {
  id: string;
  auditName: string;
  status: string;
  accessibilityScore: number;
  totalIssues: number;
  criticalIssues: number;
  seriousIssues: number;
  moderateIssues: number;
  minorIssues: number;
  completedAt: string;
}

interface AccessibilityIssue {
  id: string;
  issueTitle: string;
  issueDescription: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  wcagCriteria: string;
  wcagTitle: string;
  wcagLevel: string;
  pageUrl: string;
  elementSelector: string;
  fixSuggestion: string;
  status: string;
  affectsScreenReaders: boolean;
  affectsKeyboardNav: boolean;
  affectsColorBlindness: boolean;
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  serious: {
    icon: AlertTriangle,
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
  },
  moderate: {
    icon: Info,
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
  },
  minor: {
    icon: Info,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
};

export function AccessibilityDashboard() {
  const [audits, setAudits] = useState<AccessibilityAudit[]>([]);
  const [issues, setIssues] = useState<AccessibilityIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<AccessibilityIssue | null>(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [complianceReport, setComplianceReport] = useState<Record<string, unknown> | null>(null);
  
  const { toast } = useToast();
  
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    loadAudits();
    // eslint-disable-next-line react-hooks/immutability
    loadIssues();
    // eslint-disable-next-line react-hooks/immutability
    loadComplianceReport();
  }, []);
  
  const loadAudits = async () => {
    try {
      const response = await fetch("/api/accessibility/audits");
      if (response.ok) {
        const data = await response.json();
        setAudits(data.audits);
      }
    } catch {
      // Error handled silently
    }
  };
  
  const loadIssues = async () => {
    try {
      const response = await fetch("/api/accessibility/issues?status=open");
      if (response.ok) {
        const data = await response.json();
        setIssues(data.issues);
      }
    } catch {
      // Error handled silently
    }
  };
  
  const loadComplianceReport = async () => {
    try {
      const response = await fetch("/api/accessibility/compliance-report");
      if (response.ok) {
        const data = await response.json();
        setComplianceReport(data.report);
      }
    } catch {
      // Error handled silently
    }
  };
  
  const runAudit = async () => {
    setIsRunningAudit(true);
    
    try {
      const response = await fetch("/api/accessibility/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditName: `Audit ${new Date().toISOString()}`,
          auditType: "automated",
          targetUrl: window.location.origin,
          targetEnvironment: process.env.NODE_ENV,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        toast({
          title: "Audit Started",
          description: "Accessibility audit is running...",
        });
        
        // Poll for completion
        const auditId = data.audit.id;
        const checkStatus = setInterval(async () => {
          const statusResponse = await fetch(
            `/api/accessibility/audits/${auditId}`
          );
          const statusData = await statusResponse.json();
          
          if (statusData.audit.status === "completed") {
            clearInterval(checkStatus);
            setIsRunningAudit(false);
            
            toast({
              title: "Audit Complete",
              description: `Found ${statusData.audit.totalIssues} accessibility issues`,
            });
            
            loadAudits();
            loadIssues();
            loadComplianceReport();
          } else if (statusData.audit.status === "failed") {
            clearInterval(checkStatus);
            setIsRunningAudit(false);
            
            toast({
              title: "Audit Failed",
              description: "The audit encountered an error",
              variant: "destructive",
            });
          }
        }, 3000);
      }
    } catch {
      setIsRunningAudit(false);
      toast({
        title: "Error",
        description: "Failed to start audit",
        variant: "destructive",
      });
    }
  };
  
  const resolveIssue = async (issueId: string) => {
    try {
      const response = await fetch(`/api/accessibility/issues/${issueId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutionNotes: "Fixed and verified",
        }),
      });
      
      if (response.ok) {
        setIssues((prev) => prev.filter((i) => i.id !== issueId));
        setSelectedIssue(null);
        
        toast({
          title: "Issue Resolved",
          description: "Accessibility issue has been marked as resolved",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to resolve issue",
        variant: "destructive",
      });
    }
  };
  
  const latestAudit = audits[0];
  const openIssues = issues.filter((i) => i.status === "open");
  const criticalCount = openIssues.filter((i) => i.severity === "critical").length;
  const seriousCount = openIssues.filter((i) => i.severity === "serious").length;
  
  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Accessibility Score
            </CardTitle>
            {latestAudit && (
              latestAudit.accessibilityScore >= 80 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )
            )}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {latestAudit ? latestAudit.accessibilityScore : "â€”"}/100
            </div>
            {latestAudit && (
              <Progress
                value={latestAudit.accessibilityScore}
                className="mt-2"
              />
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Critical Issues
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {criticalCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Require immediate attention
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Serious Issues
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {seriousCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Block users with disabilities
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Open Issues
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openIssues.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all severity levels
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Accessibility Audits</CardTitle>
            <Button onClick={runAudit} disabled={isRunningAudit}>
              {isRunningAudit ? (
                <>Running Audit...</>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run New Audit
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="issues">
            <TabsList>
              <TabsTrigger value="issues">Open Issues</TabsTrigger>
              <TabsTrigger value="audits">Audit History</TabsTrigger>
              <TabsTrigger value="compliance">Compliance Report</TabsTrigger>
            </TabsList>
            
            <TabsContent value="issues" className="space-y-4">
              {openIssues.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">All Clear!</h3>
                  <p className="text-muted-foreground">
                    No open accessibility issues found
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {openIssues.map((issue) => {
                    const config = severityConfig[issue.severity];
                    const Icon = config.icon;
                    
                    return (
                      <Card
                        key={issue.id}
                        className={`border-l-4 ${config.border} cursor-pointer hover:bg-accent transition-colors`}
                        onClick={() => setSelectedIssue(issue)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold">{issue.issueTitle}</h4>
                                <Badge variant="outline">
                                  WCAG {issue.wcagCriteria}
                                </Badge>
                                <Badge variant="secondary">{issue.wcagLevel}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {issue.issueDescription}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{issue.pageUrl}</span>
                                {issue.affectsScreenReaders && (
                                  <Badge variant="outline" className="gap-1">
                                    <Eye className="h-3 w-3" />
                                    Screen Readers
                                  </Badge>
                                )}
                                {issue.affectsKeyboardNav && (
                                  <Badge variant="outline" className="gap-1">
                                    <Keyboard className="h-3 w-3" />
                                    Keyboard
                                  </Badge>
                                )}
                                {issue.affectsColorBlindness && (
                                  <Badge variant="outline" className="gap-1">
                                    <Palette className="h-3 w-3" />
                                    Color Blind
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Badge
                              variant="secondary"
                              className={config.color}
                            >
                              {issue.severity}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="audits">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Audit Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audits.map((audit) => (
                    <TableRow key={audit.id}>
                      <TableCell className="font-medium">
                        {audit.auditName}
                      </TableCell>
                      <TableCell>
                        {new Date(audit.completedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            audit.accessibilityScore >= 80
                              ? "text-green-600 font-semibold"
                              : "text-red-600 font-semibold"
                          }
                        >
                          {audit.accessibilityScore}/100
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {audit.criticalIssues > 0 && (
                            <Badge variant="destructive">
                              {audit.criticalIssues} critical
                            </Badge>
                          )}
                          {audit.seriousIssues > 0 && (
                            <Badge className="bg-orange-600">
                              {audit.seriousIssues} serious
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge>{audit.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            
            <TabsContent value="compliance">
              {complianceReport && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Total Issues</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(complianceReport as any).summary.totalIssues}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Open Issues</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(complianceReport as any).summary.openIssues}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Resolved</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(complianceReport as any).summary.resolvedIssues}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(complianceReport as any).recommendations.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(complianceReport as any).recommendations.map(
                            (rec: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2">
                                <Info className="h-4 w-4 mt-0.5 text-blue-600" />
                                <span className="text-sm">{rec}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Issue Detail Dialog */}
      <Dialog
        open={!!selectedIssue}
        onOpenChange={() => setSelectedIssue(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedIssue?.issueTitle}</DialogTitle>
            <DialogDescription>
              WCAG {selectedIssue?.wcagCriteria}: {selectedIssue?.wcagTitle}
            </DialogDescription>
          </DialogHeader>
          
          {selectedIssue && (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedIssue.issueDescription}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Location</h4>
                  <p className="text-sm">
                    <strong>Page:</strong> {selectedIssue.pageUrl}
                  </p>
                  <p className="text-sm">
                    <strong>Element:</strong>{" "}
                    <code className="bg-muted px-1 py-0.5 rounded">
                      {selectedIssue.elementSelector}
                    </code>
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">How to Fix</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedIssue.fixSuggestion}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={() => selectedIssue && resolveIssue(selectedIssue.id)}>
                    Mark as Resolved
                  </Button>
                  <Button variant="outline" asChild>
                    <a
                      href={`https://www.w3.org/WAI/WCAG22/Understanding/${selectedIssue.wcagCriteria}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View WCAG Guidelines
                    </a>
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

