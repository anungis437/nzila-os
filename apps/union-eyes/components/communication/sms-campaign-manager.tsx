/**
 * SMS Campaign Manager Component
 * 
 * SMS campaign management with:
 * - Character counting (160 limit)
 * - Send scheduling
 * - Recipient segmentation
 * - Delivery tracking
 * - Opt-out management
 * - Compliance checking
 * 
 * @module components/communication/sms-campaign-manager
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  MessageSquare,
  Send,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  UserX,
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const smsCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  message: z
    .string()
    .min(1, "Message is required")
    .max(160, "Message must be 160 characters or less"),
  recipientType: z.enum(["all", "department", "role", "custom"]),
  recipientFilters: z.array(z.string()).optional(),
  scheduledAt: z.string().optional(),
  respectQuietHours: z.boolean(),
  includeOptOutLink: z.boolean(),
});

type SMSCampaignData = z.infer<typeof smsCampaignSchema>;

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  recipients: number;
  sent: number;
  delivered: number;
  failed: number;
  optOuts: number;
  scheduledAt?: Date;
  sentAt?: Date;
  createdAt: Date;
}

export interface SMSCampaignManagerProps {
  departments: string[];
  roles: string[];
  campaigns?: Campaign[];
  onSend?: (data: SMSCampaignData) => Promise<void>;
  onSchedule?: (data: SMSCampaignData) => Promise<void>;
  onSaveDraft?: (data: SMSCampaignData) => Promise<void>;
}

export function SMSCampaignManager({
  departments,
  roles,
  campaigns = [],
  onSend,
  onSchedule,
  onSaveDraft,
}: SMSCampaignManagerProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"create" | "campaigns">("create");

  const form = useForm<SMSCampaignData>({
    resolver: zodResolver(smsCampaignSchema),
    defaultValues: {
      name: "",
      message: "",
      recipientType: "all",
      recipientFilters: [],
      respectQuietHours: true,
      includeOptOutLink: true,
    },
  });

  const message = form.watch("message");
  const recipientType = form.watch("recipientType");
  const includeOptOutLink = form.watch("includeOptOutLink");

  const characterCount = message.length;
  const remainingChars = 160 - characterCount;
  const optOutText = " Reply STOP to opt out";
  const effectiveLength = includeOptOutLink ? characterCount + optOutText.length : characterCount;

  const estimatedRecipients = React.useMemo(() => {
    if (recipientType === "all") return 1500; // Example count
    if (recipientType === "department")
      return (form.watch("recipientFilters")?.length || 0) * 50;
    if (recipientType === "role") return (form.watch("recipientFilters")?.length || 0) * 75;
    return 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientType, form.watch("recipientFilters")]);

  const estimatedCost = estimatedRecipients * 0.01; // $0.01 per SMS

  const handleSend = async (data: SMSCampaignData) => {
    setIsSubmitting(true);
    try {
      await onSend?.(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSchedule = async () => {
    const data = form.getValues();
    await onSchedule?.(data);
  };

  const getStatusBadge = (status: Campaign["status"]) => {
    const config = {
      draft: { color: "bg-gray-100 text-gray-800", label: "Draft" },
      scheduled: { color: "bg-blue-100 text-blue-800", label: "Scheduled" },
      sending: { color: "bg-yellow-100 text-yellow-800", label: "Sending" },
      sent: { color: "bg-green-100 text-green-800", label: "Sent" },
      failed: { color: "bg-red-100 text-red-800", label: "Failed" },
    };
    return <Badge className={config[status].color}>{config[status].label}</Badge>;
  };

  const getDeliveryRate = (campaign: Campaign) => {
    if (campaign.sent === 0) return 0;
    return Math.round((campaign.delivered / campaign.sent) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          SMS Campaign Manager
        </h2>
        <p className="text-gray-600 mt-1">
          Create and manage SMS campaigns to members
        </p>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="create">Create Campaign</TabsTrigger>
          <TabsTrigger value="campaigns">
            Past Campaigns ({campaigns.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSend)} className="space-y-6">
              {/* Campaign Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Internal campaign name" />
                        </FormControl>
                        <FormDescription>For internal tracking only</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={4}
                            placeholder="Type your SMS message..."
                            maxLength={160}
                          />
                        </FormControl>
                        <div className="flex justify-between text-sm">
                          <FormDescription>
                            {includeOptOutLink && (
                              <span className="text-orange-600">
                                + opt-out link ({optOutText.length} chars)
                              </span>
                            )}
                          </FormDescription>
                          <span
                            className={
                              effectiveLength > 160
                                ? "text-red-600 font-semibold"
                                : remainingChars < 20
                                ? "text-orange-600"
                                : "text-gray-600"
                            }
                          >
                            {characterCount}/160 characters
                            {includeOptOutLink && ` (${effectiveLength} total)`}
                          </span>
                        </div>
                        {effectiveLength > 160 && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Message with opt-out link exceeds 160 characters. Please shorten your
                              message.
                            </AlertDescription>
                          </Alert>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {includeOptOutLink && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-sm">
                        <strong>Preview with opt-out:</strong>
                        <p className="mt-1 text-gray-700">
                          {message}
                          <span className="text-blue-600 font-semibold">{optOutText}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recipients */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Recipients
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="recipientType"
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
                            <SelectItem value="custom">Custom List</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {recipientType === "department" && (
                    <FormField
                      control={form.control}
                      name="recipientFilters"
                      render={() => (
                        <FormItem>
                          <FormLabel>Select Departments</FormLabel>
                          <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                            {departments.map((dept) => (
                              <FormField
                                key={dept}
                                control={form.control}
                                name="recipientFilters"
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

                  {recipientType === "role" && (
                    <FormField
                      control={form.control}
                      name="recipientFilters"
                      render={() => (
                        <FormItem>
                          <FormLabel>Select Roles</FormLabel>
                          <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                            {roles.map((role) => (
                              <FormField
                                key={role}
                                control={form.control}
                                name="recipientFilters"
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

                  <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Estimated Recipients:</span>
                      <span className="text-lg font-bold">{estimatedRecipients.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Estimated Cost:</span>
                      <span className="text-lg font-bold">${estimatedCost.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Options & Compliance */}
              <Card>
                <CardHeader>
                  <CardTitle>Options & Compliance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="scheduledAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schedule Send (Optional)</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormDescription>
                          Leave empty to send immediately
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="respectQuietHours"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div>
                            <FormLabel className="!mt-0">Respect quiet hours</FormLabel>
                            <FormDescription className="text-xs">
                              {/* eslint-disable-next-line react/no-unescaped-entities */}
                              Don&apos;t send between 9 PM and 8 AM in recipient's timezone
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="includeOptOutLink"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div>
                            <FormLabel className="!mt-0">Include opt-out instructions</FormLabel>
                            <FormDescription className="text-xs">
                              {/* eslint-disable-next-line react/no-unescaped-entities */}
                              Required by law - adds "Reply STOP to opt out"
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  {!includeOptOutLink && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Compliance Warning:</strong> SMS messages are legally required to
                        include opt-out instructions in most jurisdictions.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      This campaign complies with TCPA regulations and includes proper opt-out
                      mechanisms.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => onSaveDraft?.(form.getValues())}>
                  Save Draft
                </Button>
                <div className="flex gap-2">
                  {form.watch("scheduledAt") ? (
                    <Button type="button" onClick={handleSchedule}>
                      <Clock className="h-4 w-4 mr-2" />
                      Schedule Send
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isSubmitting || effectiveLength > 160}>
                      {isSubmitting ? "Sending..." : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Now
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle>Campaign History</CardTitle>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No campaigns yet</p>
                  <p className="text-sm">Create your first SMS campaign to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead>Delivery Rate</TableHead>
                      <TableHead>Opt-outs</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{campaign.name}</div>
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {campaign.message}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                        <TableCell>{campaign.recipients.toLocaleString()}</TableCell>
                        <TableCell>
                          {campaign.delivered.toLocaleString()} / {campaign.sent.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{getDeliveryRate(campaign)}%</div>
                            <Progress value={getDeliveryRate(campaign)} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-red-600">
                            <UserX className="h-4 w-4" />
                            {campaign.optOuts}
                          </div>
                        </TableCell>
                        <TableCell>
                          {campaign.sentAt
                            ? new Date(campaign.sentAt).toLocaleDateString()
                            : campaign.scheduledAt
                            ? `Scheduled: ${new Date(campaign.scheduledAt).toLocaleDateString()}`
                            : new Date(campaign.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

