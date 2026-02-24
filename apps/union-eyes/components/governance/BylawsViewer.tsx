"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Edit, History, Eye } from "lucide-react";
 
import { useState } from "react";

interface Bylaw {
  id: string;
  article: string;
  title: string;
  content: string;
  lastUpdated: string;
  version: number;
  status: "active" | "proposed" | "archived";
}

interface BylawsViewerProps {
  organizationId: string;
  canEdit?: boolean;
}

export default function BylawsViewer({ organizationId: _organizationId, canEdit = false }: BylawsViewerProps) {
  const [selectedBylaw, setSelectedBylaw] = useState<Bylaw | null>(null);

  // Mock data - replace with actual API call
  const bylaws: Bylaw[] = [
    {
      id: "1",
      article: "Article I",
      title: "Name and Purpose",
      content: "The name of this organization shall be [Union Name], affiliated with [Parent Organization]. The purpose of this union is to represent and advance the interests of its members in all matters relating to wages, hours, and working conditions.",
      lastUpdated: "2025-06-15",
      version: 3,
      status: "active"
    },
    {
      id: "2",
      article: "Article II",
      title: "Membership",
      content: "Membership in this union shall be open to all employees of [Employer] in the bargaining unit as defined by the applicable labor relations board certification. Members shall have rights to vote, hold office, and participate in union activities according to these bylaws.",
      lastUpdated: "2025-06-15",
      version: 2,
      status: "active"
    },
    {
      id: "3",
      article: "Article III",
      title: "Officers and Duties",
      content: "The officers of this union shall consist of President, Vice-President, Secretary-Treasurer, and such other officers as may be determined by the membership. Officers shall be elected by secret ballot for a term of three years and may serve consecutive terms.",
      lastUpdated: "2024-12-01",
      version: 5,
      status: "active"
    },
    {
      id: "4",
      article: "Article IV",
      title: "Meetings",
      content: "Regular membership meetings shall be held monthly. Special meetings may be called by the Executive Board or upon written request of 10% of the membership. Quorum for meetings shall be 20% of members in good standing.",
      lastUpdated: "2025-01-10",
      version: 2,
      status: "active"
    },
    {
      id: "5",
      article: "Article V",
      title: "Dues and Finances",
      content: "Members shall pay monthly dues as determined by the membership and approved at a general meeting. The Secretary-Treasurer shall maintain accurate financial records and provide quarterly reports to the membership.",
      lastUpdated: "2025-03-20",
      version: 4,
      status: "active"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "proposed": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "archived": return "bg-gray-500/10 text-gray-700 border-gray-500/20";
      default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Bylaws List */}
      <div className="md:col-span-1 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bylaws Directory
            </CardTitle>
            <CardDescription>
              Organization governing documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {bylaws.map((bylaw) => (
              <button
                key={bylaw.id}
                onClick={() => setSelectedBylaw(bylaw)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedBylaw?.id === bylaw.id
                    ? "bg-primary/10 border-primary"
                    : "hover:bg-accent border-border"
                }`}
              >
                <div className="font-medium text-sm">{bylaw.article}</div>
                <div className="text-sm text-muted-foreground">{bylaw.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={`text-xs ${getStatusColor(bylaw.status)}`}>
                    {bylaw.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    v{bylaw.version}
                  </span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {canEdit && (
          <Button className="w-full">
            <Edit className="mr-2 h-4 w-4" />
            Propose Amendment
          </Button>
        )}
      </div>

      {/* Bylaw Content */}
      <div className="md:col-span-2">
        {selectedBylaw ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle>{selectedBylaw.article}: {selectedBylaw.title}</CardTitle>
                  <CardDescription>
                    Last updated: {new Date(selectedBylaw.lastUpdated).toLocaleDateString()} • Version {selectedBylaw.version}
                  </CardDescription>
                </div>
                <Badge variant="outline" className={getStatusColor(selectedBylaw.status)}>
                  {selectedBylaw.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <p>{selectedBylaw.content}</p>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                <Button variant="outline" size="sm">
                  <History className="mr-2 h-4 w-4" />
                  View History
                </Button>
                {canEdit && (
                  <Button variant="outline" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center py-12">
              <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Select a bylaw from the list to view its contents
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
