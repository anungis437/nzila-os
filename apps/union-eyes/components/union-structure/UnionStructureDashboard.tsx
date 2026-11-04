/**
 * Union Structure Dashboard Component
 * 
 * Main dashboard for managing union organizational structure.
 * Displays stats and provides access to entity management interfaces.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import {
  AlertCircle,
  Building2,
  MapPin,
  Users,
  Building,
  BarChart3,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale, useTranslations } from "next-intl";
import { EmployerManagement } from "./EmployerManagement";
import { WorksiteManagement } from "./WorksiteManagement";
import { BargainingUnitManagement } from "./BargainingUnitManagement";
import { CommitteeManagement } from "./CommitteeManagement";
import { StructureGraph } from "./StructureGraph";
import { fetchAllRows } from "@/lib/client/crud-lists";

interface UnionStructureDashboardProps {
  organizationId: string;
}

const LISTS = {
  employers: "/api/employers",
  worksites: "/api/worksites",
  bargainingUnits: "/api/units",
  committees: "/api/committees",
} as const;

type StatKey = keyof typeof LISTS;

const STAT_KEYS = Object.keys(LISTS) as StatKey[];

/** A count that could not be established is null: it is shown as unknown, never as zero. */
type StructureCounts = Record<StatKey, number | null>;

const COPY = {
  en: {
    loadFailed: "Some counts could not be loaded. A dash means the number is unknown, not zero.",
    retry: "Retry",
  },
  fr: {
    loadFailed: "Certains totaux n’ont pas pu être chargés. Un tiret signifie que le nombre est inconnu, et non nul.",
    retry: "Réessayer",
  },
} as const;

/**
 * The records of a list that are still in use. The list routes cannot filter by status and the Delete action archives a record
 * instead of removing it, so every page is read and archived records are left out of the count.
 */
async function countRecordsInUse(path: string): Promise<number> {
  const rows = await fetchAllRows<{ status?: string | null }>(path);
  return rows.filter((row) => row.status !== "archived").length;
}

export function UnionStructureDashboard({ organizationId }: UnionStructureDashboardProps) {
  const t = useTranslations("unionStructure.dashboard");
  const copy = useLocale().toLowerCase().startsWith("fr") ? COPY.fr : COPY.en;
  // The counts belong to the organization they were read for: those of the previous organization are not shown for the next one.
  const [loaded, setLoaded] = useState<{ organizationId: string; counts: StructureCounts } | null>(null);
  const [selectedTab, setSelectedTab] = useState("overview");
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    latestRequest.current += 1;
    const request = latestRequest.current;
    const settled = await Promise.allSettled(STAT_KEYS.map((key) => countRecordsInUse(LISTS[key])));
    if (request !== latestRequest.current) return;
    const counts: StructureCounts = { employers: null, worksites: null, bargainingUnits: null, committees: null };
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") counts[STAT_KEYS[index]] = result.value;
      else logger.error(`Failed to count ${STAT_KEYS[index]}`, result.reason);
    });
    setLoaded({ organizationId, counts });
  }, [organizationId]);

  useEffect(() => {
    void refresh();
    return () => {
      latestRequest.current += 1;
    };
  }, [refresh]);

  const retry = () => {
    setLoaded(null);
    void refresh();
  };

  const current = loaded?.organizationId === organizationId ? loaded.counts : null;
  const isLoading = current === null;
  const someCountUnknown = current !== null && STAT_KEYS.some((key) => current[key] === null);

  const statCards = [
    {
      title: t("employers"),
      value: current?.employers ?? null,
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      description: t("employersDescription"),
    },
    {
      title: t("worksites"),
      value: current?.worksites ?? null,
      icon: MapPin,
      color: "text-green-600",
      bgColor: "bg-green-50",
      description: t("worksitesDescription"),
    },
    {
      title: t("bargainingUnits"),
      value: current?.bargainingUnits ?? null,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      description: t("bargainingUnitsDescription"),
    },
    {
      title: t("committees"),
      value: current?.committees ?? null,
      icon: Building,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      description: t("committeesDescription"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      {someCountUnknown ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{copy.loadFailed}</span>
            <Button variant="outline" size="sm" onClick={retry}>
              {copy.retry}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : stat.value === null ? "—" : stat.value.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            {t("tabOverview")}
          </TabsTrigger>
          <TabsTrigger value="employers">
            <Building2 className="h-4 w-4 mr-2" />
            {t("tabEmployers")}
          </TabsTrigger>
          <TabsTrigger value="worksites">
            <MapPin className="h-4 w-4 mr-2" />
            {t("tabWorksites")}
          </TabsTrigger>
          <TabsTrigger value="units">
            <Users className="h-4 w-4 mr-2" />
            {t("tabBargainingUnits")}
          </TabsTrigger>
          <TabsTrigger value="committees">
            <Building className="h-4 w-4 mr-2" />
            {t("tabCommittees")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("orgStructureTitle")}</CardTitle>
              <CardDescription>
                {t("orgStructureDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StructureGraph organizationId={organizationId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employers">
          <EmployerManagement organizationId={organizationId} onUpdate={refresh} />
        </TabsContent>

        <TabsContent value="worksites">
          <WorksiteManagement organizationId={organizationId} onUpdate={refresh} />
        </TabsContent>

        <TabsContent value="units">
          <BargainingUnitManagement organizationId={organizationId} onUpdate={refresh} />
        </TabsContent>

        <TabsContent value="committees">
          <CommitteeManagement organizationId={organizationId} onUpdate={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
