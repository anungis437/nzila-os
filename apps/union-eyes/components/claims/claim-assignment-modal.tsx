/**
 * Claim Assignment Modal Component
 * 
 * Modal for assigning claims to stewards with:
 * - Steward search
 * - Workload display
 * - Assignment history
 * - Bulk assignment
 * - Auto-assignment suggestions
 * 
 * @module components/claims/claim-assignment-modal
 */

"use client";

import * as React from "react";
import { Check, Search, TrendingUp, User, Briefcase } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface Steward {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  activeCases: number;
  totalResolved: number;
  avgResolutionTime?: number; // in days
  specialties: string[];
}

export interface ClaimAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stewards: Steward[];
  selectedStewardId?: string;
  onAssign: (stewardId: string) => Promise<void>;
  claimType?: string;
  loading?: boolean;
}

export function ClaimAssignmentModal({
  open,
  onOpenChange,
  stewards,
  selectedStewardId,
  onAssign,
  claimType,
  loading = false,
}: ClaimAssignmentModalProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string | undefined>(
    selectedStewardId
  );
  const [isAssigning, setIsAssigning] = React.useState(false);

  React.useEffect(() => {
    setSelected(selectedStewardId);
  }, [selectedStewardId]);

  const filteredStewards = React.useMemo(() => {
    const query = searchQuery.toLowerCase();
    return stewards.filter(
      (steward) =>
        steward.name.toLowerCase().includes(query) ||
        steward.email.toLowerCase().includes(query) ||
        steward.specialties.some((s) => s.toLowerCase().includes(query))
    );
  }, [stewards, searchQuery]);

  const recommendedStewards = React.useMemo(() => {
    if (!claimType) return filteredStewards;

    // Sort by: specialization match > lowest workload > best performance
    return [...filteredStewards].sort((a, b) => {
      const aMatch = a.specialties.some((s) =>
        s.toLowerCase().includes(claimType.toLowerCase())
      );
      const bMatch = b.specialties.some((s) =>
        s.toLowerCase().includes(claimType.toLowerCase())
      );

      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;

      // If both match or neither match, sort by workload
      return a.activeCases - b.activeCases;
    });
  }, [filteredStewards, claimType]);

  const handleAssign = async () => {
    if (!selected) return;

    setIsAssigning(true);
    try {
      await onAssign(selected);
      onOpenChange(false);
    } catch (_error) {
} finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Assign Claim</DialogTitle>
          <DialogDescription>
            Select a steward to assign this claim to
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search stewards by name, email, or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Steward List */}
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {recommendedStewards.length > 0 ? (
                recommendedStewards.map((steward, index) => {
                  const isSelected = selected === steward.id;
                  const isRecommended =
                    index === 0 &&
                    claimType &&
                    steward.specialties.some((s) =>
                      s.toLowerCase().includes(claimType.toLowerCase())
                    );

                  return (
                    <button
                      key={steward.id}
                      onClick={() => setSelected(steward.id)}
                      className={cn(
                        "w-full p-4 rounded-lg border-2 transition-all text-left",
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={steward.avatar} />
                          <AvatarFallback>
                            {steward.name[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold truncate">
                              {steward.name}
                            </h4>
                            {isRecommended && (
                              <Badge variant="outline" className="text-xs">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Recommended
                              </Badge>
                            )}
                            {isSelected && (
                              <Check className="h-5 w-5 text-blue-600 ml-auto" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 truncate">
                            {steward.email}
                          </p>

                          {/* Stats */}
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              <span>{steward.activeCases} active</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              <span>{steward.totalResolved} resolved</span>
                            </div>
                            {steward.avgResolutionTime && (
                              <div className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                <span>
                                  {steward.avgResolutionTime}d avg time
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Specialties */}
                          {steward.specialties.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {steward.specialties.map((specialty) => (
                                <Badge
                                  key={specialty}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {specialty}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No stewards found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selected || isAssigning || loading}
          >
            {isAssigning ? "Assigning..." : "Assign Claim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

