/**
 * Structure Graph Component
 *
 * The employers of the organization with the worksites and bargaining units that belong to each, counted from the three lists
 * (/api/employers, /api/worksites, /api/units). Archived records are not counted. A list that cannot be read is an error with a retry,
 * never a count of zero.
 */
"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import { Building2, MapPin, Users, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  failureText,
  loadEmployers,
  loadUnits,
  loadWorksites,
  type EmployerRow,
  type UnitRow,
  type WorksiteRow,
} from "./structure-data";

interface StructureGraphProps {
  organizationId: string;
}

interface Structure {
  employers: EmployerRow[];
  worksites: WorksiteRow[];
  units: UnitRow[];
}

export function StructureGraph({ organizationId }: StructureGraphProps) {
  const [structure, setStructure] = useState<Structure | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let current = true;
    Promise.all([loadEmployers(), loadWorksites(), loadUnits()]).then(
      ([employers, worksites, units]) => {
        if (!current) return;
        setStructure({ employers, worksites, units });
        setLoadError(null);
      },
      (error: unknown) => {
        logger.error("Failed to fetch structure data", error);
        if (!current) return;
        setStructure(null);
        setLoadError(failureText(error, "Unknown error"));
      },
    );
    return () => {
      current = false;
    };
  }, [organizationId, reloadKey]);

  const retry = () => {
    setLoadError(null);
    setStructure(null);
    setReloadKey((key) => key + 1);
  };

  if (loadError !== null) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p role="alert" className="text-sm text-destructive">
          Failed to load the organizational structure: {loadError}
        </p>
        <Button variant="outline" onClick={retry}>
          Retry
        </Button>
      </div>
    );
  }

  if (structure === null) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading organizational structure...
      </div>
    );
  }

  const employers = structure.employers.filter((employer) => employer.status !== "archived");

  if (employers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No organizational structure data yet</p>
        <p className="text-sm">Add employers and worksites to see the hierarchy</p>
      </div>
    );
  }

  const countFor = (rows: Array<WorksiteRow | UnitRow>, employer: EmployerRow) =>
    rows.filter((row) => row.employerId === employer.id && row.status !== "archived").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {employers.map((employer) => {
          const worksiteCount = countFor(structure.worksites, employer);
          const unitCount = countFor(structure.units, employer);
          return (
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
                      <span>{worksiteCount} {worksiteCount === 1 ? "worksite" : "worksites"}</span>
                    </div>

                    <ChevronRight className="h-4 w-4" />

                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{unitCount} {unitCount === 1 ? "bargaining unit" : "bargaining units"}</span>
                    </div>
                  </div>
                </div>

                <Badge variant="secondary">Employer</Badge>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="text-sm text-muted-foreground text-center pt-4">
        <p>Worksites and bargaining units of each employer. Archived records are not counted.</p>
      </div>
    </div>
  );
}
