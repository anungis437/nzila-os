/**
 * Proposal Comparison Tool
 * 
 * Side-by-side comparison of union demands vs management offers.
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, DollarSign, FileText } from "lucide-react";

interface Proposal {
  id: string;
  proposalNumber: string;
  title: string;
  proposalType: string;
  status: string;
  proposedLanguage: string;
  currentLanguage?: string;
  estimatedCost?: string;
  clauseCategory?: string;
}

interface ProposalComparisonToolProps {
  proposals: Proposal[];
}

export function ProposalComparisonTool({ proposals }: ProposalComparisonToolProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Group proposals by category
  const categories = Array.from(
    new Set(proposals.map(p => p.clauseCategory).filter(Boolean))
  );

  // Filter proposals
  const unionProposals = proposals.filter(p => p.proposalType === "union_demand");
  const managementProposals = proposals.filter(p => p.proposalType === "management_offer");

  const filteredUnion = selectedCategory === "all" 
    ? unionProposals 
    : unionProposals.filter(p => p.clauseCategory === selectedCategory);

  const filteredManagement = selectedCategory === "all"
    ? managementProposals
    : managementProposals.filter(p => p.clauseCategory === selectedCategory);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposal Comparison</CardTitle>
        <CardDescription>
          Compare union demands with management offers
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Category Filters */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">All Categories</TabsTrigger>
            {categories.map(cat => (
              <TabsTrigger key={cat} value={cat || "uncategorized"}>
                {cat || "Uncategorized"}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Comparison Grid */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Union Proposals */}
          <div className="space-y-3">
            <h3 className="font-semibold text-blue-600 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Union Demands ({filteredUnion.length})
            </h3>
            {filteredUnion.length === 0 ? (
              <p className="text-sm text-muted-foreground">No union demands</p>
            ) : (
              filteredUnion.map(proposal => (
                <Card key={proposal.id} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">
                        {proposal.proposalNumber}
                      </span>
                      <Badge variant="outline">{proposal.status}</Badge>
                    </div>
                    <CardTitle className="text-sm">{proposal.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {proposal.proposedLanguage}
                    </p>
                    {proposal.estimatedCost && (
                      <div className="flex items-center gap-1 mt-2 text-xs">
                        <DollarSign className="h-3 w-3" />
                        <span>${parseFloat(proposal.estimatedCost).toLocaleString()}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Comparison Arrow */}
          <div className="hidden md:flex items-center justify-center">
            <ArrowRight className="h-8 w-8 text-muted-foreground" />
          </div>

          {/* Management Offers */}
          <div className="space-y-3">
            <h3 className="font-semibold text-orange-600 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Management Offers ({filteredManagement.length})
            </h3>
            {filteredManagement.length === 0 ? (
              <p className="text-sm text-muted-foreground">No management offers</p>
            ) : (
              filteredManagement.map(proposal => (
                <Card key={proposal.id} className="border-l-4 border-l-orange-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">
                        {proposal.proposalNumber}
                      </span>
                      <Badge variant="outline">{proposal.status}</Badge>
                    </div>
                    <CardTitle className="text-sm">{proposal.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {proposal.proposedLanguage}
                    </p>
                    {proposal.estimatedCost && (
                      <div className="flex items-center gap-1 mt-2 text-xs">
                        <DollarSign className="h-3 w-3" />
                        <span>${parseFloat(proposal.estimatedCost).toLocaleString()}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">Comparison Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Union Demands</p>
              <p className="text-2xl font-bold text-blue-600">{unionProposals.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Management Offers</p>
              <p className="text-2xl font-bold text-orange-600">{managementProposals.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Accepted Proposals</p>
              <p className="text-2xl font-bold text-green-600">
                {proposals.filter(p => p.status === "accepted").length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Under Review</p>
              <p className="text-2xl font-bold text-yellow-600">
                {proposals.filter(p => p.status === "under_review").length}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
