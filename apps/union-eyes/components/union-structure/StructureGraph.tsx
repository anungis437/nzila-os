/**
 * Structure Graph Component
 * 
 * Visualizes the organizational structure hierarchy.
 * Shows employers → worksites → bargaining units → committees
 */
"use client";

import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { Building2, MapPin, Users, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StructureGraphProps {
  organizationId: string;
}

interface Employer {
  id: string;
  name: string;
  _count?: {
    worksites: number;
    bargainingUnits: number;
  };
}

export function StructureGraph({ organizationId }: StructureGraphProps) {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/employers?organizationId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setEmployers(data.data || []);
      }
    } catch (error) {
      logger.error("Failed to fetch structure data", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading organizational structure...
      </div>
    );
  }

  if (employers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No organizational structure data yet</p>
        <p className="text-sm">Add employers and worksites to see the hierarchy</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {employers.map((employer) => (
          <Card key={employer.id} className="p-4">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              
              <div className="flex-1">
                <h3 className="font-medium">{employer.name}</h3>
                
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{employer._count?.worksites || 0} worksites</span>
                  </div>
                  
                  <ChevronRight className="h-4 w-4" />
                  
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{employer._count?.bargainingUnits || 0} bargaining units</span>
                  </div>
                </div>
              </div>

              <Badge variant="secondary">Employer</Badge>
            </div>
          </Card>
        ))}
      </div>

      <div className="text-sm text-muted-foreground text-center pt-4">
        <p>Interactive graph visualization coming soon</p>
        <p className="text-xs">Will show detailed employer → worksite → unit → committee hierarchy</p>
      </div>
    </div>
  );
}
