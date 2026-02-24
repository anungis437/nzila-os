/**
 * Tentative Agreement Viewer
 * 
 * View and manage tentative agreements before ratification.
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, DollarSign, Calendar, FileCheck } from "lucide-react";
import { format } from "date-fns";

interface TentativeAgreement {
  id: string;
  agreementNumber: string;
  title: string;
  clauseCategory: string;
  agreedLanguage: string;
  previousLanguage?: string;
  ratified: boolean;
  ratificationDate?: string;
  ratificationVoteYes?: number;
  ratificationVoteNo?: number;
  annualCost?: string;
  effectiveDate?: string;
  agreedDate: string;
}

interface TentativeAgreementViewerProps {
  agreements: TentativeAgreement[];
}

export function TentativeAgreementViewer({ agreements }: TentativeAgreementViewerProps) {
  const ratifiedAgreements = agreements.filter(a => a.ratified);
  const pendingAgreements = agreements.filter(a => !a.ratified);

  const totalCost = agreements
    .filter(a => a.annualCost)
    .reduce((sum, a) => sum + parseFloat(a.annualCost!), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Tentative Agreements</CardTitle>
            <CardDescription>
              Agreed language awaiting membership ratification
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Agreements</p>
            <p className="text-3xl font-bold">{agreements.length}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Ratified</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{ratifiedAgreements.length}</p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Pending Vote</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{pendingAgreements.length}</p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Annual Cost</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              ${totalCost.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Pending Agreements */}
        {pendingAgreements.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Pending Ratification ({pendingAgreements.length})
            </h3>
            <div className="space-y-3">
              {pendingAgreements.map((agreement) => (
                <div key={agreement.id} className="border-l-4 border-l-yellow-500 p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">
                          {agreement.agreementNumber}
                        </span>
                        <Badge>{agreement.clauseCategory}</Badge>
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending Vote
                        </Badge>
                      </div>
                      <h4 className="font-semibold">{agreement.title}</h4>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Agreed Language:</p>
                      <p className="text-sm bg-muted p-2 rounded">
                        {agreement.agreedLanguage}
                      </p>
                    </div>
                    
                    {agreement.previousLanguage && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Previous Language:</p>
                        <p className="text-sm bg-muted/50 p-2 rounded text-muted-foreground">
                          {agreement.previousLanguage}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Agreed: {format(new Date(agreement.agreedDate), "MMM d, yyyy")}
                      </span>
                      {agreement.annualCost && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${parseFloat(agreement.annualCost).toLocaleString()}/year
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline">
                      View Full Details
                    </Button>
                    <Button size="sm">
                      Schedule Ratification Vote
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ratified Agreements */}
        {ratifiedAgreements.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Ratified ({ratifiedAgreements.length})
            </h3>
            <div className="space-y-3">
              {ratifiedAgreements.map((agreement) => (
                <div key={agreement.id} className="border-l-4 border-l-green-500 p-4 border rounded-lg bg-green-50/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">
                          {agreement.agreementNumber}
                        </span>
                        <Badge>{agreement.clauseCategory}</Badge>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Ratified
                        </Badge>
                      </div>
                      <h4 className="font-semibold">{agreement.title}</h4>
                      
                      {/* Vote Results */}
                      {agreement.ratificationVoteYes !== undefined && agreement.ratificationVoteNo !== undefined && (
                        <div className="mt-2 flex items-center gap-4 text-sm">
                          <span className="text-green-600 font-medium">
                            Yes: {agreement.ratificationVoteYes}
                          </span>
                          <span className="text-red-600 font-medium">
                            No: {agreement.ratificationVoteNo}
                          </span>
                          <span className="text-muted-foreground">
                            ({(
                              (agreement.ratificationVoteYes / 
                                (agreement.ratificationVoteYes + agreement.ratificationVoteNo)) * 100
                            ).toFixed(1)}% approval)
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                        {agreement.ratificationDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Ratified: {format(new Date(agreement.ratificationDate), "MMM d, yyyy")}
                          </span>
                        )}
                        {agreement.annualCost && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${parseFloat(agreement.annualCost).toLocaleString()}/year
                          </span>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost">
                      <FileCheck className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {agreements.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileCheck className="mx-auto h-12 w-12 mb-4" />
            <p>No tentative agreements yet</p>
            <p className="text-sm">Agreements will appear here as proposals are accepted</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
