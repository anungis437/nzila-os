/**
 * Proposal Manager Component
 * 
 * Manages bargaining proposals for a negotiation.
 * Allows creating, editing, and tracking union demands and management offers.
 */

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, FileText, CheckCircle, XCircle, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Proposal {
  id: string;
  proposalNumber: string;
  title: string;
  description: string;
  proposalType: "union_demand" | "management_offer" | "joint_proposal" | "mediator_proposal";
  status: "draft" | "submitted" | "under_review" | "accepted" | "rejected" | "counter_offered" | "withdrawn" | "superseded";
  clauseCategory: string | null;
  proposedLanguage: string;
  estimatedCost: string | null;
  unionPosition: string | null;
  managementPosition: string | null;
  submittedDate: string | null;
  createdAt: string;
}

interface ProposalManagerProps {
  negotiationId: string;
}

const statusIcons = {
  draft: <Clock className="h-4 w-4" />,
  submitted: <FileText className="h-4 w-4" />,
  under_review: <AlertTriangle className="h-4 w-4" />,
  accepted: <CheckCircle className="h-4 w-4 text-green-500" />,
  rejected: <XCircle className="h-4 w-4 text-red-500" />,
  counter_offered: <TrendingUp className="h-4 w-4 text-blue-500" />,
  withdrawn: <XCircle className="h-4 w-4 text-gray-500" />,
  superseded: <Clock className="h-4 w-4 text-gray-500" />,
};

const statusColors = {
  draft: "bg-gray-500",
  submitted: "bg-blue-500",
  under_review: "bg-yellow-500",
  accepted: "bg-green-500",
  rejected: "bg-red-500",
  counter_offered: "bg-purple-500",
  withdrawn: "bg-gray-400",
  superseded: "bg-gray-400",
};

const typeColors = {
  union_demand: "bg-blue-600",
  management_offer: "bg-orange-600",
  joint_proposal: "bg-green-600",
  mediator_proposal: "bg-purple-600",
};

export function ProposalManager({ negotiationId }: ProposalManagerProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("all");
  
  // Form state
  const [formData, setFormData] = useState({
    proposalNumber: "",
    title: "",
    description: "",
    proposalType: "union_demand" as const,
    clauseCategory: "",
    proposedLanguage: "",
    rationale: "",
    estimatedCost: "",
    unionPosition: "must_have",
  });

  useEffect(() => {
    fetchProposals();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negotiationId]);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bargaining/proposals?negotiationId=${negotiationId}`);
      const data = await response.json();
      setProposals(data.proposals || []);
    } catch (error) {
      logger.error("Failed to fetch proposals", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch("/api/bargaining/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          negotiationId,
        }),
      });
      
      if (response.ok) {
        setIsCreateDialogOpen(false);
        fetchProposals();
        // Reset form
        setFormData({
          proposalNumber: "",
          title: "",
          description: "",
          proposalType: "union_demand",
          clauseCategory: "",
          proposedLanguage: "",
          rationale: "",
          estimatedCost: "",
          unionPosition: "must_have",
        });
      }
    } catch (error) {
      logger.error("Failed to create proposal", error);
    }
  };

  const filterProposals = (type: string) => {
    switch (type) {
      case "union":
        return proposals.filter(p => p.proposalType === "union_demand");
      case "management":
        return proposals.filter(p => p.proposalType === "management_offer");
      case "accepted":
        return proposals.filter(p => p.status === "accepted");
      case "pending":
        return proposals.filter(p => ["submitted", "under_review"].includes(p.status));
      default:
        return proposals;
    }
  };

  const filteredProposals = filterProposals(selectedTab);

  const stats = {
    total: proposals.length,
    union: proposals.filter(p => p.proposalType === "union_demand").length,
    management: proposals.filter(p => p.proposalType === "management_offer").length,
    accepted: proposals.filter(p => p.status === "accepted").length,
    pending: proposals.filter(p => ["submitted", "under_review"].includes(p.status)).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">Proposals</h3>
          <p className="text-muted-foreground">
            Union demands and management offers
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Proposal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Create New Proposal</DialogTitle>
                <DialogDescription>
                  Add a new bargaining proposal or demand
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="proposalNumber">Proposal Number *</Label>
                    <Input
                      id="proposalNumber"
                      value={formData.proposalNumber}
                      onChange={(e) => setFormData({ ...formData, proposalNumber: e.target.value })}
                      placeholder="e.g., UP-001"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="proposalType">Type *</Label>
                    <Select
                      value={formData.proposalType}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      onValueChange={(value: any) => setFormData({ ...formData, proposalType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="union_demand">Union Demand</SelectItem>
                        <SelectItem value="management_offer">Management Offer</SelectItem>
                        <SelectItem value="joint_proposal">Joint Proposal</SelectItem>
                        <SelectItem value="mediator_proposal">Mediator Proposal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Brief title of the proposal"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clauseCategory">Clause Category</Label>
                  <Input
                    id="clauseCategory"
                    value={formData.clauseCategory}
                    onChange={(e) => setFormData({ ...formData, clauseCategory: e.target.value })}
                    placeholder="e.g., Wages, Benefits, Hours"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detailed description of the proposal"
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proposedLanguage">Proposed Language *</Label>
                  <Textarea
                    id="proposedLanguage"
                    value={formData.proposedLanguage}
                    onChange={(e) => setFormData({ ...formData, proposedLanguage: e.target.value })}
                    placeholder="The exact proposed contract language"
                    rows={4}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rationale">Rationale</Label>
                  <Textarea
                    id="rationale"
                    value={formData.rationale}
                    onChange={(e) => setFormData({ ...formData, rationale: e.target.value })}
                    placeholder="Why this proposal is important"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="estimatedCost">Estimated Cost</Label>
                    <Input
                      id="estimatedCost"
                      type="number"
                      step="0.01"
                      value={formData.estimatedCost}
                      onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unionPosition">Union Position</Label>
                    <Select
                      value={formData.unionPosition}
                      onValueChange={(value) => setFormData({ ...formData, unionPosition: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="must_have">Must Have</SelectItem>
                        <SelectItem value="important">Important</SelectItem>
                        <SelectItem value="tradeable">Tradeable</SelectItem>
                        <SelectItem value="dropped">Dropped</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Proposal</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Union Demands</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.union}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Management Offers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.management}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Accepted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.accepted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Proposals List with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Proposals</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="union">Union Demands</TabsTrigger>
              <TabsTrigger value="management">Management Offers</TabsTrigger>
              <TabsTrigger value="accepted">Accepted</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-4">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Loading proposals...</p>
              ) : filteredProposals.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No proposals found. Create your first proposal to get started.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {filteredProposals.map((proposal) => (
                    <div
                      key={proposal.id}
                      className="border rounded-lg p-4 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">
                              {proposal.proposalNumber}
                            </span>
                            <h4 className="font-semibold">{proposal.title}</h4>
                            <Badge className={typeColors[proposal.proposalType]}>
                              {proposal.proposalType.replace("_", " ")}
                            </Badge>
                            <Badge className={statusColors[proposal.status]}>
                              {statusIcons[proposal.status]}
                              <span className="ml-1">{proposal.status.replace("_", " ")}</span>
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {proposal.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {proposal.clauseCategory && (
                              <span>Category: {proposal.clauseCategory}</span>
                            )}
                            {proposal.unionPosition && (
                              <span>Position: {proposal.unionPosition}</span>
                            )}
                            {proposal.submittedDate && (
                              <span>Submitted: {format(new Date(proposal.submittedDate), "MMM d, yyyy")}</span>
                            )}
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
