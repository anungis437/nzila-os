/**
 * Union Structure Dashboard Component
 * 
 * Main dashboard for managing union organizational structure.
 * Displays stats and provides access to entity management interfaces.
 */
"use client";

import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import {
  Building2,
  MapPin,
  Users,
  Building,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "next-intl";
import { EmployerManagement } from "./EmployerManagement";
import { WorksiteManagement } from "./WorksiteManagement";
import { BargainingUnitManagement } from "./BargainingUnitManagement";
import { CommitteeManagement } from "./CommitteeManagement";
import { StructureGraph } from "./StructureGraph";

interface UnionStructureDashboardProps {
  organizationId: string;
}

interface StructureStats {
  employersCount: number;
  worksitesCount: number;
  bargainingUnitsCount: number;
  committeesCount: number;
  stewardAssignmentsCount: number;
  totalMembers: number;
}

export function UnionStructureDashboard({ organizationId }: UnionStructureDashboardProps) {
  const t = useTranslations("unionStructure.dashboard");
  const [stats, setStats] = useState<StructureStats>({
    employersCount: 0,
    worksitesCount: 0,
    bargainingUnitsCount: 0,
    committeesCount: 0,
    stewardAssignmentsCount: 0,
    totalMembers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("overview");

  useEffect(() => {
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      
      // Fetch counts from each entity endpoint
      const [employers, worksites, units, committees, stewards, members] = await Promise.all([
        fetch(`/api/employers?organizationId=${organizationId}`).then(r => r.json()),
        fetch(`/api/worksites?organizationId=${organizationId}`).then(r => r.json()),
        fetch(`/api/units?organizationId=${organizationId}`).then(r => r.json()),
        fetch(`/api/committees?organizationId=${organizationId}`).then(r => r.json()),
        fetch(`/api/v2/stewards?organizationId=${organizationId}`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`/api/v2/organization/members?organizationId=${organizationId}`).then(r => r.json()).catch(() => ({ data: [] })),
      ]);

      setStats({
        employersCount: employers.data?.length || 0,
        worksitesCount: worksites.data?.length || 0,
        bargainingUnitsCount: units.data?.length || 0,
        committeesCount: committees.data?.length || 0,
        stewardAssignmentsCount: stewards.data?.length || stewards.results?.length || 0,
        totalMembers: members.data?.length || members.total || members.count || 0,
      });
    } catch (error) {
      logger.error("Failed to fetch structure stats", error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      title: t("employers"),
      value: stats.employersCount,
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      description: t("employersDescription"),
    },
    {
      title: t("worksites"),
      value: stats.worksitesCount,
      icon: MapPin,
      color: "text-green-600",
      bgColor: "bg-green-50",
      description: t("worksitesDescription"),
    },
    {
      title: t("bargainingUnits"),
      value: stats.bargainingUnitsCount,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      description: t("bargainingUnitsDescription"),
    },
    {
      title: t("committees"),
      value: stats.committeesCount,
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
                {isLoading ? "..." : stat.value.toLocaleString()}
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
          <EmployerManagement organizationId={organizationId} onUpdate={fetchStats} />
        </TabsContent>

        <TabsContent value="worksites">
          <WorksiteManagement organizationId={organizationId} onUpdate={fetchStats} />
        </TabsContent>

        <TabsContent value="units">
          <BargainingUnitManagement organizationId={organizationId} onUpdate={fetchStats} />
        </TabsContent>

        <TabsContent value="committees">
          <CommitteeManagement organizationId={organizationId} onUpdate={fetchStats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
