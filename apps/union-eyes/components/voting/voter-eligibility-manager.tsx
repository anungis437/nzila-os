/**
 * Voter Eligibility Manager Component
 * 
 * Manages voter eligibility rules with:
 * - Rule configuration
 * - Eligibility verification
 * - Member qualification
 * - Automatic determination
 * - Manual overrides
 * - Reporting
 * 
 * @module components/voting/voter-eligibility-manager
 */

"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  Download,
  Search,
  Filter,
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
 
 
import { Textarea } from "@/components/ui/textarea";

// Eligibility rule schema
const eligibilityRuleSchema = z.object({
  id: z.string().optional(),
  field: z.enum([
    "membershipStatus",
    "membershipDuration",
    "duesStatus",
    "jobStatus",
    "chapter",
    "workLocation",
    "memberType",
  ]),
  operator: z.enum(["equals", "notEquals", "greaterThan", "lessThan", "contains", "in"]),
  value: z.string(),
  description: z.string().optional(),
});

const eligibilityConfigSchema = z. object({
  electionId: z.string(),
  electionTitle: z.string(),
  rules: z.array(eligibilityRuleSchema).min(1),
  requireAllRules: z.boolean(),
  allowManualOverride: z.boolean(),
  notificationEnabled: z.boolean(),
});

type EligibilityRule = z.infer<typeof eligibilityRuleSchema>;
type EligibilityConfig = z.infer<typeof eligibilityConfigSchema>;

export interface Member {
  id: string;
  name: string;
  email: string;
  membershipStatus: string;
  membershipDate: Date;
  duesStatus: string;
  jobStatus: string;
  chapter: string;
  workLocation: string;
  memberType: string;
}

export interface EligibilityResult {
  memberId: string;
  eligible: boolean;
  reasons: string[];
  manualOverride?: {
    overridden: boolean;
    by: string;
    reason: string;
    date: Date;
  };
}

export interface VoterEligibilityManagerProps {
  electionId: string;
  electionTitle: string;
  members: Member[];
  existingConfig?: EligibilityConfig;
  onSaveConfig?: (config: EligibilityConfig) => Promise<void>;
  onCheckEligibility?: (memberId: string) => Promise<EligibilityResult>;
  onOverrideEligibility?: (
    memberId: string,
    eligible: boolean,
    reason: string
  ) => Promise<void>;
}

export function VoterEligibilityManager({
  electionId,
  electionTitle,
  members,
  existingConfig,
  onSaveConfig,
  onCheckEligibility,
  onOverrideEligibility,
}: VoterEligibilityManagerProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [eligibilityResults, setEligibilityResults] = React.useState<EligibilityResult[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<"all" | "eligible" | "ineligible">(
    "all"
  );

  const form = useForm<EligibilityConfig>({
    resolver: zodResolver(eligibilityConfigSchema),
    defaultValues: existingConfig || {
      electionId,
      electionTitle,
      rules: [
        {
          field: "membershipStatus",
          operator: "equals",
          value: "active",
          description: "Member must have active status",
        },
      ],
      requireAllRules: true,
      allowManualOverride: false,
      notificationEnabled: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rules",
  });

  const handleSaveConfig = async (data: EligibilityConfig) => {
    setIsLoading(true);
    try {
      await onSaveConfig?.(data);
      // Re-check all members
      await checkAllEligibility();
    } finally {
      setIsLoading(false);
    }
  };

  const checkAllEligibility = async () => {
    if (!onCheckEligibility) return;

    setIsLoading(true);
    try {
      const results = await Promise.all(
        members.map((member) => onCheckEligibility(member.id))
      );
      setEligibilityResults(results);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMembers = React.useMemo(() => {
    let filtered = members.filter((member) =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filterStatus !== "all") {
      filtered = filtered.filter((member) => {
        const result = eligibilityResults.find((r) => r.memberId === member.id);
        return filterStatus === "eligible" ? result?.eligible : !result?.eligible;
      });
    }

    return filtered;
  }, [members, searchTerm, filterStatus, eligibilityResults]);

  const eligibilityStats = React.useMemo(() => {
    const eligible = eligibilityResults.filter((r) => r.eligible).length;
    const ineligible = eligibilityResults.filter((r) => !r.eligible).length;
    const overridden = eligibilityResults.filter((r) => r.manualOverride?.overridden).length;
    return { eligible, ineligible, overridden, total: members.length };
  }, [eligibilityResults, members.length]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{members.length}</div>
            <div className="text-sm text-gray-600">Total Members</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-green-600">{eligibilityStats.eligible}</div>
            <div className="text-sm text-gray-600">Eligible Voters</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-red-600">{eligibilityStats.ineligible}</div>
            <div className="text-sm text-gray-600">Ineligible</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-orange-600">{eligibilityStats.overridden}</div>
            <div className="text-sm text-gray-600">Manual Overrides</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rules" className="w-full">
        <TabsList>
          <TabsTrigger value="rules">Eligibility Rules</TabsTrigger>
          <TabsTrigger value="members">Member Status</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
        </TabsList>

        {/* Rules Configuration */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Configure Eligibility Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveConfig)} className="space-y-6">
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <div key={field.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium">Rule {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name={`rules.${index}.field`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Field</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="membershipStatus">
                                      Membership Status
                                    </SelectItem>
                                    <SelectItem value="membershipDuration">
                                      Membership Duration
                                    </SelectItem>
                                    <SelectItem value="duesStatus">Dues Status</SelectItem>
                                    <SelectItem value="jobStatus">Job Status</SelectItem>
                                    <SelectItem value="chapter">Chapter</SelectItem>
                                    <SelectItem value="workLocation">Work Location</SelectItem>
                                    <SelectItem value="memberType">Member Type</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`rules.${index}.operator`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Operator</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="equals">Equals</SelectItem>
                                    <SelectItem value="notEquals">Not Equals</SelectItem>
                                    <SelectItem value="greaterThan">Greater Than</SelectItem>
                                    <SelectItem value="lessThan">Less Than</SelectItem>
                                    <SelectItem value="contains">Contains</SelectItem>
                                    <SelectItem value="in">In List</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`rules.${index}.value`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Value</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Enter value..." />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name={`rules.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Explain this rule..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      append({
                        field: "membershipStatus",
                        operator: "equals",
                        value: "",
                        description: "",
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rule
                  </Button>

                  <div className="space-y-4 border-t pt-4">
                    <FormField
                      control={form.control}
                      name="requireAllRules"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>Require All Rules</FormLabel>
                            <FormDescription>
                              Member must satisfy all rules (AND logic) vs any rule (OR logic)
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="allowManualOverride"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>Allow Manual Override</FormLabel>
                            <FormDescription>
                              Administrators can manually override eligibility decisions
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notificationEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>Send Notifications</FormLabel>
                            <FormDescription>
                              Notify members about their eligibility status
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={isLoading}>
                      Save Configuration
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={checkAllEligibility}
                      disabled={isLoading}
                    >
                      Check All Members
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Member Status */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Member Eligibility Status</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search members..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select
                    value={filterStatus}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onValueChange={(value: any) => setFilterStatus(value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Members</SelectItem>
                      <SelectItem value="eligible">Eligible Only</SelectItem>
                      <SelectItem value="ineligible">Ineligible Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Member List */}
                <div className="border rounded-lg divide-y">
                  {filteredMembers.map((member) => {
                    const result = eligibilityResults.find((r) => r.memberId === member.id);
                    return (
                      <MemberEligibilityRow
                        key={member.id}
                        member={member}
                        result={result}
                        allowOverride={form.watch("allowManualOverride")}
                        onOverride={onOverrideEligibility}
                      />
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Report */}
        <TabsContent value="report">
          <Card>
            <CardHeader>
              <CardTitle>Eligibility Report</CardTitle>
            </CardHeader>
            <CardContent>
              <EligibilityReport
                stats={eligibilityStats}
                rules={form.watch("rules")}
                results={eligibilityResults}
                members={members}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MemberEligibilityRow({
  member,
  result,
  allowOverride,
  onOverride,
}: {
  member: Member;
  result?: EligibilityResult;
  allowOverride: boolean;
  onOverride?: (memberId: string, eligible: boolean, reason: string) => Promise<void>;
}) {
  const [showOverrideDialog, setShowOverrideDialog] = React.useState(false);
  const [overrideReason, setOverrideReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleOverride = async (eligible: boolean) => {
    setIsSubmitting(true);
    try {
      await onOverride?.(member.id, eligible, overrideReason);
      setShowOverrideDialog(false);
      setOverrideReason("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{member.name}</h4>
            {result && (
              <Badge variant={result.eligible ? "success" : "destructive"}>
                {result.eligible ? (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                ) : (
                  <XCircle className="h-3 w-3 mr-1" />
                )}
                {result.eligible ? "Eligible" : "Ineligible"}
              </Badge>
            )}
            {result?.manualOverride?.overridden && (
              <Badge variant="outline">
                <AlertCircle className="h-3 w-3 mr-1" />
                Manual Override
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">{member.email}</p>
          {result && result.reasons.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.reasons.map((reason, index) => (
                <li key={index} className="text-sm text-gray-600">
                  • {reason}
                </li>
              ))}
            </ul>
          )}
          {result?.manualOverride?.overridden && (
            <div className="mt-2 text-sm text-orange-600">
              Override by {result.manualOverride.by}: {result.manualOverride.reason}
            </div>
          )}
        </div>
        {allowOverride && (
          <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Override
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Override Eligibility</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">
                    Override eligibility decision for {member.name}
                  </p>
                </div>
                <Textarea
                  placeholder="Reason for override..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={4}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleOverride(true)}
                    disabled={!overrideReason || isSubmitting}
                    className="flex-1"
                  >
                    Mark Eligible
                  </Button>
                  <Button
                    onClick={() => handleOverride(false)}
                    disabled={!overrideReason || isSubmitting}
                    variant="destructive"
                    className="flex-1"
                  >
                    Mark Ineligible
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

function EligibilityReport({
  stats,
  rules,
  results: _results,
  members: _members,
}: {
  stats: { eligible: number; ineligible: number; overridden: number; total: number };
  rules: EligibilityRule[];
  results: EligibilityResult[];
  members: Member[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-4">Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Total Members:</span>
            <span className="font-medium">{stats.total}</span>
          </div>
          <div className="flex justify-between text-green-600">
            <span>Eligible Voters:</span>
            <span className="font-medium">
              {stats.eligible} ({((stats.eligible / stats.total) * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>Ineligible:</span>
            <span className="font-medium">
              {stats.ineligible} ({((stats.ineligible / stats.total) * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="flex justify-between text-orange-600">
            <span>Manual Overrides:</span>
            <span className="font-medium">{stats.overridden}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-4">Active Rules</h3>
        <div className="space-y-2">
          {rules.map((rule, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded-lg">
              <div className="font-medium">
                {/* eslint-disable-next-line react/no-unescaped-entities */}
                {rule.field} {rule.operator} "{rule.value}"
              </div>
              {rule.description && (
                <div className="text-sm text-gray-600 mt-1">{rule.description}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Button className="w-full">
        <Download className="h-4 w-4 mr-2" />
        Download Full Report
      </Button>
    </div>
  );
}

