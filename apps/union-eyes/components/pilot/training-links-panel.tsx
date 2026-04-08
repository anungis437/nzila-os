/**
 * Training Links Panel
 *
 * In-app training resources and guides for union staff.
 * Links to member filing guide, steward workflow guide,
 * admin setup guide, and evidence export guide.
 *
 * @module components/pilot/training-links-panel
 */

"use client";

import * as React from "react";
import {
  BookOpen as _BookOpen,
  FileText,
  Users,
  Settings,
  Download,
  ExternalLink,
  GraduationCap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────

export interface TrainingLink {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  audience: string;
  isExternal?: boolean;
}

export interface TrainingLinksPanelProps {
  links?: TrainingLink[];
  className?: string;
}

// ─── Default training resources ───────────────────────────────

const DEFAULT_LINKS: TrainingLink[] = [
  {
    id: "member-filing",
    title: "Member Grievance Filing Guide",
    description: "Step-by-step walkthrough of how members submit an intake through Union Eyes.",
    icon: FileText,
    href: "/docs/guides/member-filing",
    audience: "Members",
  },
  {
    id: "steward-workflow",
    title: "Steward Workflow Guide",
    description:
      "How stewards triage, investigate, and manage grievances through the queue and workspace.",
    icon: Users,
    href: "/docs/guides/steward-workflow",
    audience: "Stewards",
  },
  {
    id: "admin-setup",
    title: "Administration & Organization Setup",
    description:
      "Configuring your organization, inviting users, assigning roles, and managing settings.",
    icon: Settings,
    href: "/docs/guides/admin-setup",
    audience: "Administrators",
  },
  {
    id: "evidence-export",
    title: "Evidence Export Guide",
    description:
      "How to generate and export evidence packs for arbitration proceedings.",
    icon: Download,
    href: "/docs/guides/evidence-export",
    audience: "Officers & Stewards",
  },
];

// ─── Component ────────────────────────────────────────────────

export function TrainingLinksPanel({
  links,
  className,
}: TrainingLinksPanelProps) {
  const resources = links ?? DEFAULT_LINKS;

  return (
    <Card className={cn("p-5 space-y-4", className)}>
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Training & Guides</h3>
        <Badge variant="secondary" className="text-[10px] ml-auto">
          {resources.length} resources
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Access training material to help your team get the most out of Union Eyes.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {resources.map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.id}
              href={link.href}
              target={link.isExternal ? "_blank" : undefined}
              rel={link.isExternal ? "noopener noreferrer" : undefined}
              className="group flex items-start gap-3 p-3 rounded-md border hover:bg-muted/50 hover:border-primary/30 transition-colors"
            >
              <div className="p-2 rounded-md bg-muted group-hover:bg-primary/10 transition-colors">
                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">
                    {link.title}
                  </span>
                  {link.isExternal && (
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  {link.description}
                </p>
                <Badge variant="outline" className="text-[9px] mt-1.5">
                  {link.audience}
                </Badge>
              </div>
            </a>
          );
        })}
      </div>
    </Card>
  );
}
