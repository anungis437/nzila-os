"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Send,
  CheckCircle,
  PenTool,
  Clock,
  Plus,
  Eye,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { NewLetterComposer } from "./new-letter-composer";

// ── Types ──────────────────────────────────────────────────────────────────

interface CorrespondenceItem {
  id: string;
  referenceNumber: string | null;
  subject: string;
  status: string;
  type: string;
  priority: string;
  draftedBy: string;
  assignedSignerId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CorrespondenceDashboardProps {
  organizationId: string;
  userId: string;
  userRole: string;
  canSign: boolean;
}

// ── Status Helpers ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  draft: { label: "Draft", variant: "secondary", icon: <FileText size={14} /> },
  pending_review: { label: "Pending Review", variant: "default", icon: <Clock size={14} /> },
  approved: { label: "Approved", variant: "outline", icon: <CheckCircle size={14} /> },
  signed: { label: "Signed", variant: "default", icon: <PenTool size={14} /> },
  dispatched: { label: "Dispatched", variant: "default", icon: <Send size={14} /> },
  delivered: { label: "Delivered", variant: "default", icon: <CheckCircle size={14} /> },
  returned: { label: "Returned", variant: "destructive", icon: <AlertTriangle size={14} /> },
  cancelled: { label: "Cancelled", variant: "destructive", icon: <XCircle size={14} /> },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "",
  high: "text-orange-600",
  urgent: "text-red-600 font-semibold",
};

// ── Component ──────────────────────────────────────────────────────────────

export function CorrespondenceDashboard({
  organizationId: _organizationId,
  userId,
  userRole: _userRole,
  canSign,
}: CorrespondenceDashboardProps) {
  const [items, setItems] = useState<CorrespondenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [showNewDialog, setShowNewDialog] = useState(false);

  const fetchItems = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      const res = await fetch(`/api/correspondence?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setItems(json.data?.data ?? json.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const status = activeTab === "all" ? undefined : activeTab;
    fetchItems(status);
  }, [activeTab, fetchItems]);

  // ── Stats Cards ──────────────────────────────────────────────────────────

  const stats = {
    draft: items.filter((i) => i.status === "draft").length,
    pending: items.filter((i) => i.status === "pending_review").length,
    signed: items.filter((i) => i.status === "signed").length,
    dispatched: items.filter((i) => i.status === "dispatched").length,
  };

  const needsMyAction = items.filter((i) => {
    if (i.status === "pending_review" && canSign && i.assignedSignerId === userId) return true;
    if (i.status === "approved" && canSign && i.assignedSignerId === userId) return true;
    if (i.status === "signed" && i.draftedBy === userId) return true; // clerk dispatches
    return false;
  });

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Signed</CardTitle>
            <PenTool className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.signed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispatched</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.dispatched}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Action Required Banner ────────────────────────────────────── */}
      {needsMyAction.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <span className="font-medium">
                {needsMyAction.length} item{needsMyAction.length !== 1 ? "s" : ""} need
                {needsMyAction.length === 1 ? "s" : ""} your action
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tabbed List ───────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Drafts</TabsTrigger>
            <TabsTrigger value="pending_review">Pending Review</TabsTrigger>
            <TabsTrigger value="signed">Signed</TabsTrigger>
            <TabsTrigger value="dispatched">Dispatched</TabsTrigger>
          </TabsList>
          <Button size="sm" onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Letter
          </Button>
        </div>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading...
              </CardContent>
            </Card>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No correspondence found
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.draft;
                return (
                  <Card key={item.id} className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-muted-foreground">{cfg.icon}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{item.subject}</span>
                            <span className={`text-xs ${PRIORITY_COLORS[item.priority] ?? ""}`}>
                              {item.priority !== "normal" ? item.priority.toUpperCase() : ""}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <span>{item.referenceNumber}</span>
                            <span>&middot;</span>
                            <span className="capitalize">{item.type}</span>
                            <span>&middot;</span>
                            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── New Letter Dialog ─────────────────────────────────────────── */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">New Letter</DialogTitle>
          <NewLetterComposer
            onCreated={() => {
              setShowNewDialog(false);
              fetchItems(activeTab === "all" ? undefined : activeTab);
            }}
            onCancel={() => setShowNewDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
