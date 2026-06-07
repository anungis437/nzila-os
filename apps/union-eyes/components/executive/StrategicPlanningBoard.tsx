"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, Calendar, Users, CheckCircle, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

interface StrategicGoal {
  id: string;
  title: string;
  description: string;
  category: "membership" | "financial" | "advocacy" | "operations";
  progress: number;
  dueDate: string;
  owner: string;
  status: "on-track" | "at-risk" | "delayed" | "completed";
}

interface StrategicPlanningBoardProps {
  goals?: StrategicGoal[];
}

export default function StrategicPlanningBoard({ goals }: StrategicPlanningBoardProps) {
  const [fetchedGoals, setFetchedGoals] = useState<StrategicGoal[]>([]);
  const [loading, setLoading] = useState(!goals);

  const fetchGoals = useCallback(async () => {
    if (goals) return;
    try {
      setLoading(true);
      const res = await fetch("/api/v2/executive/strategic-goals");
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json) ? json : json?.goals ?? json?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setFetchedGoals(items.map((g: any) => ({
          id: g.id ?? "",
          title: g.title ?? "",
          description: g.description ?? "",
          category: g.category ?? "operations",
          progress: g.progress ?? 0,
          dueDate: g.due_date ?? g.dueDate ?? "",
          owner: g.owner ?? "",
          status: g.status ?? "on-track",
        })));
      }
    } catch {
      // API not available — empty state
    } finally {
      setLoading(false);
    }
  }, [goals]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const activeGoals = goals || fetchedGoals;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "membership": return <Users className="h-4 w-4" />;
      case "financial": return <Target className="h-4 w-4" />;
      case "operations": return <CheckCircle className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on-track": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "at-risk": return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      case "delayed": return "bg-red-500/10 text-red-700 border-red-500/20";
      case "completed": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Strategic Planning Board
        </CardTitle>
        <CardDescription>
          Track progress on organizational goals and initiatives
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activeGoals.map((goal) => (
            <Card key={goal.id} className="border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(goal.category)}
                      <CardTitle className="text-base">{goal.title}</CardTitle>
                    </div>
                    <CardDescription className="text-sm">
                      {goal.description}
                    </CardDescription>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(goal.status)}
                  >
                    {goal.status.replace("-", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-2" />
                </div>

                {/* Meta Information */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Due: {new Date(goal.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{goal.owner}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
