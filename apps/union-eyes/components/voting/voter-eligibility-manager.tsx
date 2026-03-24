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
import { useTranslations } from "next-intl";

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
  const t = useTranslations("voting.eligibility");

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
            <div className="text-sm text-gray-600">{t("totalMembers")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-green-600">{eligibilityStats.eligible}</div>
            <div className="text-sm text-gray-600">{t("eligibleVoters")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-red-600">{eligibilityStats.ineligible}</div>
            <div className="text-sm text-gray-600">{t("ineligible")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-orange-600">{eligibilityStats.overridden}</div>
            <div className="text-sm text-gray-600">{t("manualOverrides")}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rules" className="w-full">
        <TabsList>
          <TabsTrigger value="rules">{t("rulesTab")}</TabsTrigger>
          <TabsTrigger value="members">{t("membersTab")}</TabsTrigger>
          <TabsTrigger value="report">{t("reportTab")}</TabsTrigger>
        </TabsList>

        {/* Rules Configuration */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>{t("rulesTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveConfig)} className="space-y-6">
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <div key={field.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium">{t("ruleNumber", { number: index + 1 })}</h4>
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
                                <FormLabel>{t("fieldLabel")}</FormLabel>
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
                                      {t("fieldMembershipStatus")}
                                    </SelectItem>
                                    <SelectItem value="membershipDuration">
                                      {t("fieldMembershipDuration")}
                                    </SelectItem>
                                    <SelectItem value="duesStatus">{t("fieldDuesStatus")}</SelectItem>
                                    <SelectItem value="jobStatus">{t("fieldJobStatus")}</SelectItem>
                                    <SelectItem value="chapter">{t("fieldChapter")}</SelectItem>
                                    <SelectItem value="workLocation">{t("fieldWorkLocation")}</SelectItem>
                                    <SelectItem value="memberType">{t("fieldMemberType")}</SelectItem>
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
                                <FormLabel>{t("operatorLabel")}</FormLabel>
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
                                    <SelectItem value="equals">{t("operatorEquals")}</SelectItem>
                                    <SelectItem value="notEquals">{t("operatorNotEquals")}</SelectItem>
                                    <SelectItem value="greaterThan">{t("operatorGreaterThan")}</SelectItem>
                                    <SelectItem value="lessThan">{t("operatorLessThan")}</SelectItem>
                                    <SelectItem value="contains">{t("operatorContains")}</SelectItem>
                                    <SelectItem value="in">{t("operatorInList")}</SelectItem>
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
                                <FormLabel>{t("valueLabel")}</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder={t("valuePlaceholder")} />
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
                              <FormLabel>{t("descriptionLabel")}</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder={t("descriptionPlaceholder")} />
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
                    {t("addRuleButton")}
                  </Button>

                  <div className="space-y-4 border-t pt-4">
                    <FormField
                      control={form.control}
                      name="requireAllRules"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>{t("requireAllRulesLabel")}</FormLabel>
                            <FormDescription>
                              {t("requireAllRulesHelp")}
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
                            <FormLabel>{t("allowOverrideLabel")}</FormLabel>
                            <FormDescription>
                              {t("allowOverrideHelp")}
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
                            <FormLabel>{t("notificationsLabel")}</FormLabel>
                            <FormDescription>
                              {t("notificationsHelp")}
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
                      {t("saveConfigButton")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={checkAllEligibility}
                      disabled={isLoading}
                    >
                      {t("checkAllButton")}
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
                <CardTitle>{t("memberStatusTitle")}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    {t("exportButton")}
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
                      placeholder={t("searchPlaceholder")}
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
                      <SelectItem value="all">{t("filterAll")}</SelectItem>
                      <SelectItem value="eligible">{t("filterEligible")}</SelectItem>
                      <SelectItem value="ineligible">{t("filterIneligible")}</SelectItem>
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
              <CardTitle>{t("reportTitle")}</CardTitle>
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
  const t = useTranslations("voting.eligibility");

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
                {result.eligible ? t("badgeEligible") : t("badgeIneligible")}
              </Badge>
            )}
            {result?.manualOverride?.overridden && (
              <Badge variant="outline">
                <AlertCircle className="h-3 w-3 mr-1" />
                {t("badgeOverride")}
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
              {t("overrideBy", { name: result.manualOverride.by })}: {result.manualOverride.reason}
            </div>
          )}
        </div>
        {allowOverride && (
          <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                {t("overrideButton")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("overrideDialogTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">
                    {t("overrideDialogDescription", { name: member.name })}
                  </p>
                </div>
                <Textarea
                  placeholder={t("overrideReasonPlaceholder")}
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
                    {t("markEligible")}
                  </Button>
                  <Button
                    onClick={() => handleOverride(false)}
                    disabled={!overrideReason || isSubmitting}
                    variant="destructive"
                    className="flex-1"
                  >
                    {t("markIneligible")}
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
  const t = useTranslations("voting.eligibility");
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-4">{t("reportSummary")}</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>{t("reportTotalMembers")}:</span>
            <span className="font-medium">{stats.total}</span>
          </div>
          <div className="flex justify-between text-green-600">
            <span>{t("reportEligible")}:</span>
            <span className="font-medium">
              {stats.eligible} ({((stats.eligible / stats.total) * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>{t("reportIneligible")}:</span>
            <span className="font-medium">
              {stats.ineligible} ({((stats.ineligible / stats.total) * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="flex justify-between text-orange-600">
            <span>{t("reportOverrides")}:</span>
            <span className="font-medium">{stats.overridden}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-4">{t("reportActiveRules")}</h3>
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
        {t("downloadReport")}
      </Button>
    </div>
  );
}

