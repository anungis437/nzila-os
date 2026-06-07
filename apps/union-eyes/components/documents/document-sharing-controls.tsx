/**
 * Document Sharing Controls Component
 * 
 * Granular sharing permissions with:
 * - Share with individuals/groups
 * - Permission levels
 * - Expiration dates
 * - Access links
 * - Share tracking
 * - Revoke access
 * 
 * @module components/documents/document-sharing-controls
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Share2,
  Link as LinkIcon,
  Copy,
  Users,
  User,
  Trash2,
  Eye,
  Edit,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
 
import { format, formatDistanceToNow } from "date-fns";

const shareSchema = z.object({
  targetType: z.enum(["user", "group", "link"]),
  targetId: z.string().optional(),
  permission: z.enum(["view", "comment", "edit", "admin"]),
  expiresAt: z.date().optional(),
  notifyTarget: z.boolean(),
  message: z.string().optional(),
});

type ShareFormData = z.infer<typeof shareSchema>;

export interface ShareRecord {
  id: string;
  targetType: "user" | "group" | "link";
  targetId?: string;
  targetName?: string;
  permission: "view" | "comment" | "edit" | "admin";
  sharedBy: {
    id: string;
    name: string;
  };
  sharedAt: Date;
  expiresAt?: Date;
  lastAccessed?: Date;
  accessCount: number;
  linkUrl?: string;
}

export interface UserOption {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface GroupOption {
  id: string;
  name: string;
  memberCount: number;
}

export interface DocumentSharingControlsProps {
  documentId: string;
  documentName: string;
  shares: ShareRecord[];
  users: UserOption[];
  groups: GroupOption[];
  onShare?: (data: ShareFormData) => Promise<void>;
  onRevokeShare?: (shareId: string) => Promise<void>;
  onUpdatePermission?: (shareId: string, permission: string) => Promise<void>;
  onCopyLink?: (share: ShareRecord) => void;
}

export function DocumentSharingControls({
  documentId: _documentId,
  documentName,
  shares,
  users,
  groups,
  onShare,
  onRevokeShare,
  onUpdatePermission,
  onCopyLink,
}: DocumentSharingControlsProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<ShareFormData>({
    resolver: zodResolver(shareSchema),
    defaultValues: {
      targetType: "user",
      permission: "view",
      notifyTarget: true,
    },
  });

  const targetType = form.watch("targetType");

  const handleShare = async (data: ShareFormData) => {
    setIsSubmitting(true);
    try {
      await onShare?.(data);
      setDialogOpen(false);
      form.reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeShares = shares.filter((share) => {
    if (!share.expiresAt) return true;
    return share.expiresAt > new Date();
  });

  const expiredShares = shares.filter((share) => {
    if (!share.expiresAt) return false;
    return share.expiresAt <= new Date();
  });

  const stats = {
    total: activeShares.length,
    users: activeShares.filter((s) => s.targetType === "user").length,
    groups: activeShares.filter((s) => s.targetType === "group").length,
    links: activeShares.filter((s) => s.targetType === "link").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sharing Settings</h2>
          <p className="text-gray-600 mt-1">{documentName}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={() => setDialogOpen(true)}>
            <Share2 className="h-4 w-4 mr-2" />
            Share Document
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Document</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleShare)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="targetType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Share With</FormLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: "user", icon: User, label: "User" },
                          { value: "group", icon: Users, label: "Group" },
                          { value: "link", icon: LinkIcon, label: "Link" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => field.onChange(option.value)}
                            className={cn(
                              "flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-all",
                              field.value === option.value
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300"
                            )}
                          >
                            <option.icon className="h-5 w-5" />
                            <span className="text-sm font-medium">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </FormItem>
                  )}
                />

                {targetType !== "link" && (
                  <FormField
                    control={form.control}
                    name="targetId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {targetType === "user" ? "Select User" : "Select Group"}
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={`Choose a ${targetType}...`} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {(targetType === "user" ? users : groups).map((option: any) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.name}
                                {option.email && ` (${option.email})`}
                                {option.memberCount && ` - ${option.memberCount} members`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="permission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permission Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="view">
                            <div>
                              <div className="font-medium">View</div>
                              <div className="text-xs text-gray-600">Can view only</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="comment">
                            <div>
                              <div className="font-medium">Comment</div>
                              <div className="text-xs text-gray-600">
                                Can view and add comments
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="edit">
                            <div>
                              <div className="font-medium">Edit</div>
                              <div className="text-xs text-gray-600">Can view and edit</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="admin">
                            <div>
                              <div className="font-medium">Admin</div>
                              <div className="text-xs text-gray-600">Full control</div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? new Date(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Access will automatically expire after this date
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {targetType !== "link" && (
                  <>
                    <FormField
                      control={form.control}
                      name="notifyTarget"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0">Send notification email</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Add a personal message..." />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Sharing..." : "Share"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Shares</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{stats.users}</div>
            <div className="text-sm text-gray-600">Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{stats.groups}</div>
            <div className="text-sm text-gray-600">Groups</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{stats.links}</div>
            <div className="text-sm text-gray-600">Share Links</div>
          </CardContent>
        </Card>
      </div>

      {/* Shares List */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Active ({activeShares.length})</TabsTrigger>
          <TabsTrigger value="expired">Expired ({expiredShares.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardContent className="p-6">
              {activeShares.length === 0 ? (
                <div className="text-center py-8">
                  <Share2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No active shares</h3>
                  <p className="text-gray-600 mb-4">Share this document to collaborate</p>
                  <Button onClick={() => setDialogOpen(true)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Document
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeShares.map((share) => (
                    <ShareItem
                      key={share.id}
                      share={share}
                      onRevoke={() => onRevokeShare?.(share.id)}
                      onUpdatePermission={(permission) =>
                        onUpdatePermission?.(share.id, permission)
                      }
                      onCopyLink={() => onCopyLink?.(share)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expired">
          <Card>
            <CardContent className="p-6">
              {expiredShares.length === 0 ? (
                <div className="text-center py-8 text-gray-600">No expired shares</div>
              ) : (
                <div className="space-y-4">
                  {expiredShares.map((share) => (
                    <ShareItem key={share.id} share={share} isExpired />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ShareItem({
  share,
  isExpired,
  onRevoke,
  onUpdatePermission,
  onCopyLink,
}: {
  share: ShareRecord;
  isExpired?: boolean;
  onRevoke?: () => void;
  onUpdatePermission?: (permission: string) => void;
  onCopyLink?: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    onCopyLink?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTypeIcon = () => {
    switch (share.targetType) {
      case "user":
        return <User className="h-4 w-4" />;
      case "group":
        return <Users className="h-4 w-4" />;
      case "link":
        return <LinkIcon className="h-4 w-4" />;
    }
  };

  const getPermissionIcon = () => {
    switch (share.permission) {
      case "view":
        return <Eye className="h-3 w-3" />;
      case "edit":
        return <Edit className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "border rounded-lg p-4",
        isExpired && "opacity-60 bg-gray-50"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            {getTypeIcon()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium truncate">
                {share.targetName || `${share.targetType} Share`}
              </h4>
              {isExpired && <Badge variant="secondary">Expired</Badge>}
            </div>

            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                {getPermissionIcon()}
                <span className="capitalize">{share.permission}</span>
              </div>
              <span>•</span>
              <span>Shared {formatDistanceToNow(share.sharedAt, { addSuffix: true })}</span>
              {share.expiresAt && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Expires {format(share.expiresAt, "MMM d, yyyy")}</span>
                  </div>
                </>
              )}
            </div>

            {share.targetType === "link" && share.accessCount > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                <Eye className="h-3 w-3 inline mr-1" />
                Accessed {share.accessCount} times
                {share.lastAccessed && (
                  <span className="ml-1">
                    (last: {formatDistanceToNow(share.lastAccessed, { addSuffix: true })})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {!isExpired && (
          <div className="flex gap-2">
            {share.targetType === "link" && (
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
            {onUpdatePermission && (
              <Select
                value={share.permission}
                onValueChange={onUpdatePermission}
              >
                <SelectTrigger className="w-[100px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="comment">Comment</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            )}
            {onRevoke && (
              <Button variant="ghost" size="sm" onClick={onRevoke}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

