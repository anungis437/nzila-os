/**
 * Report Sharing Hub Component
 * 
 * Report distribution management with:
 * - Access control and permissions
 * - Subscription management
 * - Report versioning
 * - Embed codes generation
 * - Public link sharing
 * - Download tracking
 * 
 * @module components/analytics/report-sharing-hub
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Share2,
  Users,
  Link2,
  Mail,
  Download,
  Eye,
  Lock,
  Globe,
  Copy,
  Check,
  Code,
  Trash2,
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const shareReportSchema = z.object({
  reportId: z.string(),
  accessType: z.enum(["private", "organization", "public"]),
  permissions: z.object({
    canView: z.boolean(),
    canDownload: z.boolean(),
    canEdit: z.boolean(),
    canShare: z.boolean(),
  }),
  users: z.array(z.string()),
  expiresAt: z.string().optional(),
  requirePassword: z.boolean(),
  password: z.string().optional(),
});

type ShareReportData = z.infer<typeof shareReportSchema>;

interface Report {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
  accessType: "private" | "organization" | "public";
}

interface SharedAccess {
  id: string;
  reportId: string;
  reportName: string;
  sharedWith: string;
  permissions: string[];
  sharedAt: Date;
  expiresAt?: Date;
  views: number;
  downloads: number;
}

interface Subscriber {
  id: string;
  email: string;
  reportId: string;
  frequency: "daily" | "weekly" | "monthly";
  format: "pdf" | "excel" | "csv";
  subscribedAt: Date;
  lastSent?: Date;
}

export interface ReportSharingHubProps {
  reports?: Report[];
  sharedAccess?: SharedAccess[];
  subscribers?: Subscriber[];
  onShare?: (data: ShareReportData) => Promise<void>;
  onRevoke?: (accessId: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubscribe?: (data: any) => Promise<void>;
  onUnsubscribe?: (subscriberId: string) => Promise<void>;
}

export function ReportSharingHub({
  reports = [],
  sharedAccess = [],
  subscribers = [],
  onShare,
  onRevoke,
  onSubscribe: _onSubscribe,
  onUnsubscribe,
}: ReportSharingHubProps) {
  const [selectedReport, setSelectedReport] = React.useState<Report | null>(null);
  const [shareLink, setShareLink] = React.useState<string>("");
  const [embedCode, setEmbedCode] = React.useState<string>("");
  const [copied, setCopied] = React.useState<"link" | "embed" | null>(null);

  const form = useForm<ShareReportData>({
    resolver: zodResolver(shareReportSchema),
    defaultValues: {
      reportId: "",
      accessType: "private",
      permissions: {
        canView: true,
        canDownload: false,
        canEdit: false,
        canShare: false,
      },
      users: [],
      requirePassword: false,
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const accessType = form.watch("accessType");
  const requirePassword = form.watch("requirePassword");

  const handleShare = async (data: ShareReportData) => {
    await onShare?.(data);
    generateShareLink(data);
    generateEmbedCode(data);
  };

  const generateShareLink = (data: ShareReportData) => {
    // This would generate actual share link in production
    const link = `https://app.unioneyes.com/reports/shared/${data.reportId}?access=${data.accessType}`;
    setShareLink(link);
  };

  const generateEmbedCode = (data: ShareReportData) => {
    const code = `<iframe src="https://app.unioneyes.com/reports/embed/${data.reportId}" width="100%" height="600" frameborder="0"></iframe>`;
    setEmbedCode(code);
  };

  const copyToClipboard = async (text: string, type: "link" | "embed") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const _getAccessTypeBadge = (type: Report["accessType"]) => {
    const config = {
      private: { color: "bg-gray-100 text-gray-800", icon: <Lock className="h-3 w-3" />, label: "Private" },
      organization: { color: "bg-blue-100 text-blue-800", icon: <Users className="h-3 w-3" />, label: "Organization" },
      public: { color: "bg-green-100 text-green-800", icon: <Globe className="h-3 w-3" />, label: "Public" },
    };
    const cfg = config[type];
    return (
      <Badge className={cfg.color}>
        {cfg.icon}
        <span className="ml-1">{cfg.label}</span>
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Share2 className="h-6 w-6" />
          Report Sharing Hub
        </h2>
        <p className="text-gray-600 mt-1">
          Manage report access, subscriptions, and distribution
        </p>
      </div>

      <Tabs defaultValue="share">
        <TabsList>
          <TabsTrigger value="share">Share Report</TabsTrigger>
          <TabsTrigger value="access">
            Shared Access ({sharedAccess.length})
          </TabsTrigger>
          <TabsTrigger value="subscribers">
            Subscribers ({subscribers.length})
          </TabsTrigger>
        </TabsList>

        {/* Share Report Tab */}
        <TabsContent value="share">
          <div className="grid grid-cols-12 gap-6">
            {/* Report Selection */}
            <div className="col-span-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Select Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {reports.map((report) => (
                      <Button
                        key={report.id}
                        variant={selectedReport?.id === report.id ? "default" : "outline"}
                        className="w-full justify-start h-auto py-3"
                        onClick={() => {
                          setSelectedReport(report);
                          form.setValue("reportId", report.id);
                        }}
                      >
                        <div className="text-left w-full">
                          <div className="font-medium">{report.name}</div>
                          <div className="text-xs opacity-70 mt-1">
                            {report.description}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sharing Options */}
            <div className="col-span-8">
              {!selectedReport ? (
                <Card>
                  <CardContent className="text-center py-12 text-gray-500">
                    <Share2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Select a report to configure sharing</p>
                  </CardContent>
                </Card>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleShare)} className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Sharing Settings for: {selectedReport.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="accessType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Access Level</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="private">
                                    <div className="flex items-center gap-2">
                                      <Lock className="h-4 w-4" />
                                      Private - Specific people only
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="organization">
                                    <div className="flex items-center gap-2">
                                      <Users className="h-4 w-4" />
                                      Organization - Anyone in org
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="public">
                                    <div className="flex items-center gap-2">
                                      <Globe className="h-4 w-4" />
                                      Public - Anyone with link
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {accessType === "private" && (
                          <FormField
                            control={form.control}
                            name="users"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Share with Users</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="Enter email addresses, comma-separated"
                                    onChange={(e) => {
                                      const emails = e.target.value
                                        .split(",")
                                        .map((email) => email.trim());
                                      field.onChange(emails);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        <div className="space-y-3 border rounded-lg p-4">
                          <h4 className="font-semibold text-sm">Permissions</h4>
                          <FormField
                            control={form.control}
                            name="permissions.canView"
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between">
                                <FormLabel className="!mt-0">Can View</FormLabel>
                                <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="permissions.canDownload"
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between">
                                <FormLabel className="!mt-0">Can Download</FormLabel>
                                <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="permissions.canEdit"
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between">
                                <FormLabel className="!mt-0">Can Edit</FormLabel>
                                <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="permissions.canShare"
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between">
                                <FormLabel className="!mt-0">Can Share</FormLabel>
                                <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="expiresAt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Expiration Date (Optional)</FormLabel>
                              <FormControl>
                                <Input type="datetime-local" {...field} />
                              </FormControl>
                              <FormDescription>
                                Access will be revoked after this date
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="requirePassword"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between border rounded-lg p-3">
                              <FormLabel className="!mt-0">Require Password</FormLabel>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        {requirePassword && (
                          <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                  <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </CardContent>
                    </Card>

                    <div className="flex justify-end">
                      <Button type="submit">
                        <Share2 className="h-4 w-4 mr-2" />
                        Generate Share Link
                      </Button>
                    </div>
                  </form>
                </Form>
              )}

              {/* Share Links */}
              {shareLink && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Link2 className="h-5 w-5" />
                      Share Links
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Share Link</Label>
                      <div className="flex gap-2 mt-2">
                        <Input value={shareLink} readOnly />
                        <Button
                          variant="outline"
                          onClick={() => copyToClipboard(shareLink, "link")}
                        >
                          {copied === "link" ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label>Embed Code</Label>
                      <div className="mt-2">
                        <Textarea value={embedCode} readOnly rows={3} />
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => copyToClipboard(embedCode, "embed")}
                        >
                          {copied === "embed" ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Code className="h-4 w-4 mr-2" />
                              Copy Embed Code
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Shared Access Tab */}
        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle>Shared Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {sharedAccess.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Share2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No shared reports yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report</TableHead>
                      <TableHead>Shared With</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Shared Date</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sharedAccess.map((access) => (
                      <TableRow key={access.id}>
                        <TableCell className="font-medium">{access.reportName}</TableCell>
                        <TableCell>{access.sharedWith}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {access.permissions.map((perm) => (
                              <Badge key={perm} variant="outline" className="text-xs">
                                {perm}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{access.sharedAt.toLocaleDateString()}</TableCell>
                        <TableCell>
                          {access.expiresAt
                            ? access.expiresAt.toLocaleDateString()
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {access.views} views
                            </div>
                            <div className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              {access.downloads} downloads
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRevoke?.(access.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscribers Tab */}
        <TabsContent value="subscribers">
          <Card>
            <CardHeader>
              <CardTitle>Report Subscribers</CardTitle>
            </CardHeader>
            <CardContent>
              {subscribers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No subscribers yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Report</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Subscribed</TableHead>
                      <TableHead>Last Sent</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscribers.map((subscriber) => (
                      <TableRow key={subscriber.id}>
                        <TableCell>{subscriber.email}</TableCell>
                        <TableCell className="font-medium">{subscriber.reportId}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{subscriber.frequency}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{subscriber.format.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>{subscriber.subscribedAt.toLocaleDateString()}</TableCell>
                        <TableCell>
                          {subscriber.lastSent
                            ? subscriber.lastSent.toLocaleDateString()
                            : "Not sent yet"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onUnsubscribe?.(subscriber.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
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

