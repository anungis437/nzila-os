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
      title: "Employers",
      value: stats.employersCount,
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      description: "Companies with union members",
    },
    {
      title: "Worksites",
      value: stats.worksitesCount,
      icon: MapPin,
      color: "text-green-600",
      bgColor: "bg-green-50",
      description: "Physical work locations",
    },
    {
      title: "Bargaining Units",
      value: stats.bargainingUnitsCount,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      description: "Certified bargaining units",
    },
    {
      title: "Committees",
      value: stats.committeesCount,
      icon: Building,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      description: "Active committees",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Union Structure</h1>
          <p className="text-muted-foreground mt-1">
            Manage organizational structure, employers, worksites, and bargaining units
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
            Overview
          </TabsTrigger>
          <TabsTrigger value="employers">
            <Building2 className="h-4 w-4 mr-2" />
            Employers
          </TabsTrigger>
          <TabsTrigger value="worksites">
            <MapPin className="h-4 w-4 mr-2" />
            Worksites
          </TabsTrigger>
          <TabsTrigger value="units">
            <Users className="h-4 w-4 mr-2" />
            Bargaining Units
          </TabsTrigger>
          <TabsTrigger value="committees">
            <Building className="h-4 w-4 mr-2" />
            Committees
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organizational Structure</CardTitle>
              <CardDescription>
                {/* eslint-disable-next-line react/no-unescaped-entities */}
                Visual representation of your union's organizational hierarchy
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
