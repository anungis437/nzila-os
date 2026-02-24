/**
 * Claim Detail View Enhanced Component
 * 
 * Complete claim information display with:
 * - Full claim details
 * - Timeline/activity feed
 * - Comments/notes
 * - Document attachments
 * - Status updates
 * - Assignment history
 * - Actions menu
 * 
 * @module components/claims/claim-detail-view-enhanced
 */

"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Calendar,
  MapPin,
  User,
  FileText,
  Paperclip,
  Clock,
  MoreVertical,
  Edit,
  Trash,
  Archive,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
 
 
 
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ClaimDetail {
  claimId: string;
  claimNumber: string;
  memberName: string;
  memberEmail: string;
  claimType: string;
  status: string;
  priority: string;
  incidentDate: Date;
  location: string;
  description: string;
  desiredOutcome: string;
  witnessesPresent: boolean;
  witnessDetails?: string;
  previouslyReported: boolean;
  previousReportDetails?: string;
  assignedTo?: string;
  assignedToName?: string;
  attachments: Array<{ id: string; name: string; url: string; type: string }>;
  activity: Array<{
    id: string;
    type: string;
    timestamp: Date;
    user: string;
    message: string;
  }>;
  comments: Array<{
    id: string;
    user: string;
    userAvatar?: string;
    timestamp: Date;
    message: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClaimDetailViewEnhancedProps {
  claim: ClaimDetail;
  onStatusChange?: (status: string) => void;
  onPriorityChange?: (priority: string) => void;
  onAssign?: (userId: string) => void;
  onAddComment?: (comment: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  userRole?: "member" | "steward" | "admin";
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  "in-review": { label: "In Review", color: "bg-blue-100 text-blue-800" },
  "under-investigation": { label: "Investigating", color: "bg-purple-100 text-purple-800" },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-800" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-gray-100 text-gray-800" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-800" },
  high: { label: "High", color: "bg-orange-100 text-orange-800" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-800" },
};

export function ClaimDetailViewEnhanced({
  claim,
  onStatusChange: _onStatusChange,
  onPriorityChange: _onPriorityChange,
  onAssign: _onAssign,
  onAddComment,
  onEdit,
  onDelete,
  onArchive,
  userRole = "member",
}: ClaimDetailViewEnhancedProps) {
  const [newComment, setNewComment] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const canEdit = userRole !== "member";

  const handleAddComment = async () => {
    if (!newComment.trim() || !onAddComment) return;

    setIsSubmitting(true);
    try {
      await onAddComment(newComment);
      setNewComment("");
    } catch (_error) {
} finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Claim #{claim.claimNumber}</h1>
            <Badge className={statusConfig[claim.status]?.color}>
              {statusConfig[claim.status]?.label}
            </Badge>
            <Badge className={priorityConfig[claim.priority]?.color}>
              {priorityConfig[claim.priority]?.label}
            </Badge>
          </div>
          <p className="text-gray-600">
            Submitted by {claim.memberName} on{" "}
            {format(claim.createdAt, "PPP")}
          </p>
        </div>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Claim
                </DropdownMenuItem>
              )}
              {onArchive && (
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="activity">
                Activity ({claim.activity.length})
              </TabsTrigger>
              <TabsTrigger value="comments">
                Comments ({claim.comments.length})
              </TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Incident Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <FileText className="h-4 w-4" />
                        Type
                      </div>
                      <p className="font-medium capitalize">{claim.claimType}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <Calendar className="h-4 w-4" />
                        Incident Date
                      </div>
                      <p className="font-medium">
                        {format(claim.incidentDate, "PPP")}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <MapPin className="h-4 w-4" />
                        Location
                      </div>
                      <p className="font-medium">{claim.location}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {claim.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Desired Outcome</h4>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {claim.desiredOutcome}
                    </p>
                  </div>

                  {claim.witnessesPresent && claim.witnessDetails && (
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-2">Witnesses</h4>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {claim.witnessDetails}
                      </p>
                    </div>
                  )}

                  {claim.previouslyReported && claim.previousReportDetails && (
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-2">Previous Reports</h4>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {claim.previousReportDetails}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Attachments */}
              {claim.attachments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Paperclip className="h-5 w-5" />
                      Attachments ({claim.attachments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {claim.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          <FileText className="h-5 w-5 text-gray-400" />
                          <span className="flex-1 text-sm truncate">
                            {attachment.name}
                          </span>
                          <span className="text-xs text-gray-500 uppercase">
                            {attachment.type}
                          </span>
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {claim.activity.map((activity, index) => (
                      <div key={activity.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          {index < claim.activity.length - 1 && (
                            <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-sm font-medium">{activity.message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {activity.user} â€¢{" "}
                            {format(activity.timestamp, "PPp")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Comments Tab */}
            <TabsContent value="comments">
              <Card>
                <CardContent className="pt-6 space-y-6">
                  {/* Comment List */}
                  <div className="space-y-4">
                    {claim.comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.userAvatar} />
                          <AvatarFallback>
                            {comment.user[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">
                                {comment.user}
                              </span>
                              <span className="text-xs text-gray-500">
                                {format(comment.timestamp, "PPp")}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">
                              {comment.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Comment */}
                  <div className="border-t pt-4">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end mt-2">
                      <Button
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || isSubmitting}
                        size="sm"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        {isSubmitting ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Metadata */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <User className="h-4 w-4" />
                  Assigned To
                </div>
                <p className="font-medium">
                  {claim.assignedToName || "Unassigned"}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Clock className="h-4 w-4" />
                  Created
                </div>
                <p className="font-medium">{format(claim.createdAt, "PPp")}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Clock className="h-4 w-4" />
                  Last Updated
                </div>
                <p className="font-medium">{format(claim.updatedAt, "PPp")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

