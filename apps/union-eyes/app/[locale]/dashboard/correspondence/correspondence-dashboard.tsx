"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FileText, Send, CheckCircle, PenTool, Clock, Plus, Eye, AlertTriangle, XCircle } from "lucide-react";
import { ApiShapeError, readApiError } from "@/lib/client/api-envelope";
import { NewLetterComposer } from "./new-letter-composer";
import { CorrespondenceDetailDialog } from "./correspondence-detail-dialog";
import { readCorrespondenceList, type CorrespondenceListItem, type CorrespondenceStatus } from "./correspondence-readers";

// ── Constants ──────────────────────────────────────────────────────────────

/** The most letters one read asks for. The counts and tabs below cover the letters that were read; a full read says so. */
const LIMIT = 200;

const STATUS_VARIANT: Record<CorrespondenceStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  pending_review: "default",
  approved: "outline",
  signed: "default",
  dispatched: "default",
  delivered: "default",
  returned: "destructive",
  cancelled: "destructive",
};

const STATUS_ICON: Record<CorrespondenceStatus, React.ReactNode> = {
  draft: <FileText size={14} />,
  pending_review: <Clock size={14} />,
  approved: <CheckCircle size={14} />,
  signed: <PenTool size={14} />,
  dispatched: <Send size={14} />,
  delivered: <CheckCircle size={14} />,
  returned: <AlertTriangle size={14} />,
  cancelled: <XCircle size={14} />,
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "",
  high: "text-orange-600",
  urgent: "text-red-600 font-semibold",
};

const TABS = ["all", "draft", "pending_review", "approved", "signed", "dispatched"] as const;

type LoadFailure = { reason: "server"; message: string } | { reason: "unexpected" | "generic" };

interface CorrespondenceDashboardProps {
  organizationId: string;
  userId: string;
  userRole: string;
  canSign: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export function CorrespondenceDashboard({ organizationId: _organizationId, userId, userRole: _userRole, canSign }: CorrespondenceDashboardProps) {
  const t = useTranslations("correspondencePage");
  const locale = useLocale();
  const [items, setItems] = useState<CorrespondenceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("all");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // One read of the letters serves the counts and every tab, so a count never depends on which tab is open. A read that fails is reported;
  // it is never shown as an empty correspondence queue.
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/correspondence?limit=${LIMIT}`, { cache: "no-store" });
      if (!response.ok) {
        const message = await readApiError(response, "");
        setItems([]);
        setFailure(message ? { reason: "server", message } : { reason: "generic" });
        return;
      }
      setItems(readCorrespondenceList(await response.json()));
    } catch (error) {
      setItems([]);
      setFailure({ reason: error instanceof ApiShapeError ? "unexpected" : "generic" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (value: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value);

  const count = (status: CorrespondenceStatus) => items.filter((item) => item.status === status).length;
  const shown = activeTab === "all" ? items : items.filter((item) => item.status === activeTab);

  const needsMyAction = items.filter((item) => {
    if (item.status === "pending_review") return canSign && item.assignedSignerId === userId && item.draftedBy !== userId;
    if (item.status === "approved") return canSign && item.assignedSignerId === userId;
    if (item.status === "signed") return item.draftedBy === userId; // the clerk dispatches
    return false;
  });

  const failureText = failure ? (failure.reason === "server" ? failure.message : failure.reason === "unexpected" ? t("loadUnexpected") : t("loadFailed")) : null;

  return (
    <div className="space-y-6">
      {failureText && (
        <Card role="alert" className="border-red-200 bg-red-50">
          <CardContent className="pt-4 text-red-700">
            {failureText}
            <Button size="sm" variant="outline" className="ml-3" onClick={() => void load()}>
              {t("retry")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["draft", t("stats.drafts"), <FileText key="draft" className="h-4 w-4 text-muted-foreground" />],
            ["pending_review", t("stats.awaitingReview"), <Clock key="pending" className="h-4 w-4 text-muted-foreground" />],
            ["signed", t("stats.signed"), <PenTool key="signed" className="h-4 w-4 text-muted-foreground" />],
            ["dispatched", t("stats.dispatched"), <Send key="dispatched" className="h-4 w-4 text-muted-foreground" />],
          ] as const
        ).map(([status, label, icon]) => (
          <Card key={status} data-testid={`correspondence-stat-${status}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              {icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{failure ? "—" : count(status)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length >= LIMIT && <p className="text-xs text-muted-foreground">{t("truncated", { count: LIMIT })}</p>}

      {/* ── Action Required Banner ────────────────────────────────────── */}
      {needsMyAction.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
          <CardContent className="space-y-2 pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <span className="font-medium">{t("needsAction", { count: needsMyAction.length })}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {needsMyAction.slice(0, 5).map((item) => (
                <Button key={item.id} size="sm" variant="outline" onClick={() => setOpenId(item.id)}>
                  {item.subject}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tabbed List ───────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as (typeof TABS)[number])}>
        <div className="flex items-center justify-between">
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {t(`tabs.${tab}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button size="sm" onClick={() => setShowNewDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("newLetter")}
          </Button>
        </div>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">{t("loading")}</CardContent>
            </Card>
          ) : failure ? null : shown.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">{t("empty")}</CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {shown.map((item) => (
                <Card key={item.id} className="transition-colors hover:bg-accent/50">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="text-muted-foreground">{STATUS_ICON[item.status]}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <button type="button" className="truncate text-left font-medium hover:underline" onClick={() => setOpenId(item.id)}>
                            {item.subject}
                          </button>
                          <span className={`text-xs ${PRIORITY_COLORS[item.priority] ?? ""}`}>
                            {item.priority !== "normal" ? priorityLabel(t, item.priority).toUpperCase() : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {item.referenceNumber && (
                            <>
                              <span>{item.referenceNumber}</span>
                              <span>&middot;</span>
                            </>
                          )}
                          <span>{typeLabel(t, item.type)}</span>
                          <span>&middot;</span>
                          <span>{formatDate(item.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[item.status]}>{t(`status.${item.status}`)}</Badge>
                      <Button variant="ghost" size="icon" aria-label={t("open", { subject: item.subject })} onClick={() => setOpenId(item.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Letter Dialog ─────────────────────────────────────────────── */}
      <CorrespondenceDetailDialog letterId={openId} viewer={{ userId, canSign }} onClose={() => setOpenId(null)} onChanged={() => void load(true)} />

      {/* ── New Letter Dialog ─────────────────────────────────────────── */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle className="sr-only">{t("newLetter")}</DialogTitle>
          <NewLetterComposer
            userId={userId}
            canSign={canSign}
            onCreated={() => {
              setShowNewDialog(false);
              void load(true);
            }}
            onCancel={() => setShowNewDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Translate = ReturnType<typeof useTranslations>;

const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const TYPES = new Set(["letter", "notice", "memo", "demand", "response", "proposal", "agreement", "report", "other"]);
const priorityLabel = (t: Translate, priority: string): string => (PRIORITIES.has(priority) ? t(`priority.${priority}`) : priority);
const typeLabel = (t: Translate, type: string): string => (TYPES.has(type) ? t(`type.${type}`) : type);
