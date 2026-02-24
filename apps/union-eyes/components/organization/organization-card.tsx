import React from 'react';
/**
 * Organization Card Component
 * Reusable card for displaying organization summaries
 */
import { 
  Building2, 
  Globe, 
  Users, 
  MapPin, 
  Network,
  GitBranch,
  FileText,
  ChevronRight
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Organization, OrganizationType, OrganizationStatus } from "@/types/organization";

// Organization type configurations
const typeConfig: Record<OrganizationType, { label: string; icon: React.ReactElement; color: string }> = {
  platform: { label: "Platform", icon: <Globe className="w-4 h-4" />, color: "text-gray-700 bg-gray-100 border-gray-200" },
  congress: { label: "Congress", icon: <Globe className="w-4 h-4" />, color: "text-blue-700 bg-blue-100 border-blue-200" },
  federation: { label: "Federation", icon: <Network className="w-4 h-4" />, color: "text-purple-700 bg-purple-100 border-purple-200" },
  union: { label: "Union", icon: <Building2 className="w-4 h-4" />, color: "text-green-700 bg-green-100 border-green-200" },
  local: { label: "Local", icon: <Users className="w-4 h-4" />, color: "text-orange-700 bg-orange-100 border-orange-200" },
  region: { label: "Region", icon: <MapPin className="w-4 h-4" />, color: "text-teal-700 bg-teal-100 border-teal-200" },
  district: { label: "District", icon: <GitBranch className="w-4 h-4" />, color: "text-indigo-700 bg-indigo-100 border-indigo-200" }
};

const statusConfig: Record<OrganizationStatus, { label: string; color: string; dotColor: string }> = {
  active: { label: "Active", color: "text-green-700 bg-green-100 border-green-200", dotColor: "bg-green-500" },
  inactive: { label: "Inactive", color: "text-gray-700 bg-gray-100 border-gray-200", dotColor: "bg-gray-500" },
  suspended: { label: "Suspended", color: "text-red-700 bg-red-100 border-red-200", dotColor: "bg-red-500" },
  archived: { label: "Archived", color: "text-slate-700 bg-slate-100 border-slate-200", dotColor: "bg-slate-500" }
};

interface OrganizationCardProps {
  organization: Organization & {
    memberCount?: number;
    childCount?: number;
    activeClaims?: number;
    parentName?: string;
  };
  onClick?: () => void;
  showStats?: boolean;
  showParent?: boolean;
  compact?: boolean;
}

export function OrganizationCard({ 
  organization, 
  onClick, 
  showStats = true,
  showParent = false,
  compact = false 
}: OrganizationCardProps) {
  const typeInfo = typeConfig[organization.organization_type];
  const statusInfo = statusConfig[organization.status];

  if (compact) {
    return (
      <Card 
        className="hover:bg-accent transition-colors cursor-pointer"
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded border ${typeInfo.color}`}>
                {typeInfo.icon}
              </div>
              <div>
                <div className="font-medium">{organization.name}</div>
                <div className="text-xs text-muted-foreground">{organization.slug}</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-lg border ${typeInfo.color}`}>
              {typeInfo.icon}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{organization.name}</h3>
              {organization.slug && (
                <p className="text-sm text-muted-foreground">@{organization.slug}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={`${typeInfo.color} text-xs`}>
                  {typeInfo.label}
                </Badge>
                <Badge variant="outline" className={`${statusInfo.color} text-xs`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusInfo.dotColor}`} />
                  {statusInfo.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(organization as any).description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(organization as any).description}
          </p>
        )}

        {/* Parent */}
        {showParent && organization.parentName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Network className="w-3 h-3" />
            <span>Part of {organization.parentName}</span>
          </div>
        )}

        {/* Stats */}
        {showStats && (
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Users className="w-3 h-3" />
                <span>Members</span>
              </div>
              <div className="text-lg font-semibold">{organization.memberCount || 0}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Network className="w-3 h-3" />
                <span>Children</span>
              </div>
              <div className="text-lg font-semibold">{organization.childCount || 0}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <FileText className="w-3 h-3" />
                <span>Claims</span>
              </div>
              <div className="text-lg font-semibold text-orange-600">
                {organization.activeClaims || 0}
              </div>
            </div>
          </div>
        )}

        {/* Metadata - use top-level fields instead of settings */}
        {(organization.jurisdiction || organization.sectors) && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
            {organization.sectors && organization.sectors.length > 0 && (
              <div className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                <span className="capitalize">{organization.sectors[0].replace(/_/g, ' ')}</span>
              </div>
            )}
            {organization.jurisdiction && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{organization.jurisdiction}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

