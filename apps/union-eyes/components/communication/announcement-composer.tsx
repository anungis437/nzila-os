/**
 * Announcement Composer Component
 * 
 * Announcement creation with:
 * - Rich text editor
 * - Audience targeting
 * - Scheduling
 * - Priority levels
 * - Attachments
 * - Preview mode
 * 
 * @module components/communication/announcement-composer
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Megaphone,
  Send,
  Users,
  Eye,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const announcementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  audienceType: z.enum(["all", "department", "role", "custom"]),
  audienceFilters: z.array(z.string()).optional(),
  scheduledAt: z.string().optional(),
  expiresAt: z.string().optional(),
  allowComments: z.boolean(),
  sendEmail: z.boolean(),
  sendPush: z.boolean(),
  pinned: z.boolean(),
});

type AnnouncementData = z.infer<typeof announcementSchema>;

export interface AnnouncementComposerProps {
  departments: string[];
  roles: string[];
  onPublish?: (data: AnnouncementData) => Promise<void>;
  onSaveDraft?: (data: AnnouncementData) => Promise<void>;
  onCancel?: () => void;
}

export function AnnouncementComposer({
  departments,
  roles,
  onPublish,
  onSaveDraft,
  onCancel,
}: AnnouncementComposerProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [_attachments, _setAttachments] = React.useState<File[]>([]);

  const form = useForm<AnnouncementData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: "",
      content: "",
      priority: "normal",
      audienceType: "all",
      audienceFilters: [],
      allowComments: true,
      sendEmail: false,
      sendPush: true,
      pinned: false,
    },
  });

  const handlePublish = async (data: AnnouncementData) => {
    setIsSubmitting(true);
    try {
      await onPublish?.(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    const data = form.getValues();
    await onSaveDraft?.(data);
  };

  const priorityConfig = {
    low: { color: "bg-gray-100 text-gray-800", label: "Low", icon: "ℹ️" },
    normal: { color: "bg-blue-100 text-blue-800", label: "Normal", icon: "📢" },
    high: { color: "bg-orange-100 text-orange-800", label: "High", icon: "⚠️" },
    urgent: { color: "bg-red-100 text-red-800", label: "Urgent", icon: "🚨" },
  };

  const audienceType = form.watch("audienceType");
  const estimatedReach = React.useMemo(() => {
    // Calculate estimated audience size based on filters
    // This would be calculated server-side in production
    if (audienceType === "all") return "All members";
    if (audienceType === "department") return `~${form.watch("audienceFilters")?.length || 0} departments`;
    if (audienceType === "role") return `~${form.watch("audienceFilters")?.length || 0} roles`;
    return "Custom selection";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceType, form.watch("audienceFilters")]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6" />
          Create Announcement
        </h2>
        <p className="text-gray-600 mt-1">
          Compose and publish announcements to members
        </p>
      </div>

      <Tabs defaultValue="compose" value={showPreview ? "preview" : "compose"}>
        <TabsList>
          <TabsTrigger value="compose" onClick={() => setShowPreview(false)}>
            Compose
          </TabsTrigger>
          <TabsTrigger value="preview" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handlePublish)} className="space-y-6">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Content</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter announcement title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={8}
                            placeholder="Write your announcement message..."
                          />
                        </FormControl>
                        <FormDescription>
                          Supports markdown formatting
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(priorityConfig).map(([key, config]) => (
                              <SelectItem key={key} value={key}>
                                {config.icon} {config.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Audience */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Audience
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="audienceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Audience</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">All Members</SelectItem>
                            <SelectItem value="department">By Department</SelectItem>
                            <SelectItem value="role">By Role</SelectItem>
                            <SelectItem value="custom">Custom Selection</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {audienceType === "department" && (
                    <FormField
                      control={form.control}
                      name="audienceFilters"
                      render={() => (
                        <FormItem>
                          <FormLabel>Select Departments</FormLabel>
                          <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                            {departments.map((dept) => (
                              <FormField
                                key={dept}
                                control={form.control}
                                name="audienceFilters"
                                render={({ field }) => (
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={field.value?.includes(dept)}
                                      onCheckedChange={(checked) => {
                                        const current = field.value || [];
                                        const updated = checked
                                          ? [...current, dept]
                                          : current.filter((d) => d !== dept);
                                        field.onChange(updated);
                                      }}
                                    />
                                    <Label className="text-sm">{dept}</Label>
                                  </div>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {audienceType === "role" && (
                    <FormField
                      control={form.control}
                      name="audienceFilters"
                      render={() => (
                        <FormItem>
                          <FormLabel>Select Roles</FormLabel>
                          <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                            {roles.map((role) => (
                              <FormField
                                key={role}
                                control={form.control}
                                name="audienceFilters"
                                render={({ field }) => (
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={field.value?.includes(role)}
                                      onCheckedChange={(checked) => {
                                        const current = field.value || [];
                                        const updated = checked
                                          ? [...current, role]
                                          : current.filter((r) => r !== role);
                                        field.onChange(updated);
                                      }}
                                    />
                                    <Label className="text-sm">{role}</Label>
                                  </div>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-sm font-medium">Estimated Reach: {estimatedReach}</div>
                  </div>
                </CardContent>
              </Card>

              {/* Options */}
              <Card>
                <CardHeader>
                  <CardTitle>Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="scheduledAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Schedule (Optional)</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormDescription>
                            Leave empty to publish immediately
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="expiresAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expires At (Optional)</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormDescription>
                            Automatically hide after this date
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="pinned"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div>
                            <FormLabel className="!mt-0">Pin to top</FormLabel>
                            <FormDescription className="text-xs">
                              Keep this announcement at the top of the list
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="allowComments"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0">Allow comments</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sendEmail"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0">Send email notification</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sendPush"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0">Send push notification</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <div className="flex gap-2">
                  {onSaveDraft && (
                    <Button type="button" variant="outline" onClick={handleSaveDraft}>
                      Save Draft
                    </Button>
                  )}
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Publishing..." : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Publish
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {form.watch("priority") &&
                    priorityConfig[form.watch("priority")].icon}
                  {form.watch("title") || "Untitled Announcement"}
                </CardTitle>
                <Badge className={priorityConfig[form.watch("priority")].color}>
                  {priorityConfig[form.watch("priority")].label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap">
                  {form.watch("content") || "No content yet"}
                </p>
              </div>

              <div className="mt-6 pt-6 border-t">
                <div className="text-sm text-gray-600 space-y-1">
                  <div>
                    <strong>Audience:</strong> {estimatedReach}
                  </div>
                  {form.watch("scheduledAt") && (
                    <div>
                      <strong>Scheduled:</strong> {new Date(form.watch("scheduledAt")!).toLocaleString()}
                    </div>
                  )}
                  {form.watch("expiresAt") && (
                    <div>
                      <strong>Expires:</strong> {new Date(form.watch("expiresAt")!).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

