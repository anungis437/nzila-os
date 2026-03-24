/**
 * Nomination Form Component
 * 
 * Candidate nomination workflow with:
 * - Self-nomination
 * - Nomination by others
 * - Statement submission
 * - Document upload
 * - Validation
 * - Seconder support
 * 
 * @module components/voting/nomination-form
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  User,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Users,
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

// Nomination schema
const nominationSchema = z.object({
  electionId: z.string().min(1, "Election is required"),
  positionId: z.string().min(1, "Position is required"),
  nominationType: z.enum(["self", "nominated"]),
  candidateId: z.string().min(1, "Candidate is required"),
  candidateName: z.string().min(1, "Candidate name is required"),
  candidateEmail: z.string().email("Invalid email"),
  nominatorId: z.string().optional(),
  nominatorName: z.string().optional(),
  nominatorEmail: z.string().email("Invalid email").optional(),
  statement: z
    .string()
    .min(100, "Statement must be at least 100 characters")
    .max(2000, "Statement must not exceed 2000 characters"),
  qualifications: z.string().min(50, "Please describe your qualifications").optional(),
  platformPoints: z.string().optional(),
  seconderId: z.string().optional(),
  seconderName: z.string().optional(),
  seconderEmail: z.string().email("Invalid email").optional(),
  acceptedTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms and conditions",
  }),
  consentToPublish: z.boolean(),
  documents: z.array(z.instanceof(File)).optional(),
});

type NominationFormData = z.infer<typeof nominationSchema>;

export interface Election {
  id: string;
  title: string;
  positions: Position[];
  nominationStart: Date;
  nominationEnd: Date;
  requiresSeconder: boolean;
  maxStatementLength: number;
}

export interface Position {
  id: string;
  title: string;
  description: string;
  maxNominees?: number;
  currentNominees: number;
}

export interface Member {
  id: string;
  name: string;
  email: string;
}

export interface NominationFormProps {
  election: Election;
  currentUser: Member;
  members: Member[];
  onSubmit?: (data: NominationFormData) => Promise<void>;
  onSaveDraft?: (data: Partial<NominationFormData>) => void;
  existingDraft?: Partial<NominationFormData>;
}

export function NominationForm({
  election,
  currentUser,
  members,
  onSubmit,
  onSaveDraft,
  existingDraft,
}: NominationFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedPosition, setSelectedPosition] = React.useState<Position | null>(null);
  const [uploadedFiles, setUploadedFiles] = React.useState<File[]>([]);
  const t = useTranslations("voting.nomination");

  const form = useForm<NominationFormData>({
    resolver: zodResolver(nominationSchema),
    defaultValues: existingDraft || {
      electionId: election.id,
      nominationType: "self",
      candidateId: currentUser.id,
      candidateName: currentUser.name,
      candidateEmail: currentUser.email,
      nominatorId: currentUser.id,
      nominatorName: currentUser.name,
      nominatorEmail: currentUser.email,
      statement: "",
      qualifications: "",
      platformPoints: "",
      acceptedTerms: false,
      consentToPublish: true,
    },
  });

  const nominationType = form.watch("nominationType");
  const positionId = form.watch("positionId");

  React.useEffect(() => {
    if (positionId) {
      const position = election.positions.find((p) => p.id === positionId);
      setSelectedPosition(position || null);
    }
  }, [positionId, election.positions]);

  // Auto-save draft
  React.useEffect(() => {
    const subscription = form.watch((data) => {
      onSaveDraft?.(data as Partial<NominationFormData>);
    });
    return () => subscription.unsubscribe();
  }, [form, onSaveDraft]);

  const handleSubmit = async (data: NominationFormData) => {
    setIsLoading(true);
    try {
      await onSubmit?.(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles([...uploadedFiles, ...files]);
    form.setValue("documents", [...uploadedFiles, ...files]);
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    form.setValue("documents", newFiles);
  };

  const isNominationOpen = React.useMemo(() => {
    const now = new Date();
    return now >= election.nominationStart && now <= election.nominationEnd;
  }, [election]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-gray-600 mt-2">{election.title}</p>
      </div>

      {/* Status Alert */}
      {!isNominationOpen && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t("nominationsClosed")} {election.nominationStart.toLocaleDateString()} {t("dateSeparator")} {election.nominationEnd.toLocaleDateString()}.
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Nomination Type */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t("nominationType")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="nominationType"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="grid grid-cols-2 gap-4">
                        <div
                          className={cn(
                            "border-2 rounded-lg p-4 cursor-pointer transition-all",
                            field.value === "self"
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                          onClick={() => {
                            field.onChange("self");
                            form.setValue("candidateId", currentUser.id);
                            form.setValue("candidateName", currentUser.name);
                            form.setValue("candidateEmail", currentUser.email);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <User className="h-6 w-6" />
                            <div>
                              <div className="font-medium">{t("selfLabel")}</div>
                              <div className="text-sm text-gray-600">
                                {t("selfDescription")}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div
                          className={cn(
                            "border-2 rounded-lg p-4 cursor-pointer transition-all",
                            field.value === "nominated"
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                          onClick={() => {
                            field.onChange("nominated");
                            form.setValue("candidateId", "");
                            form.setValue("candidateName", "");
                            form.setValue("candidateEmail", "");
                            form.setValue("nominatorId", currentUser.id);
                            form.setValue("nominatorName", currentUser.name);
                            form.setValue("nominatorEmail", currentUser.email);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Users className="h-6 w-6" />
                            <div>
                              <div className="font-medium">{t("nominatedLabel")}</div>
                              <div className="text-sm text-gray-600">
                                {t("nominatedDescription")}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Position Selection */}
          <Card>
            <CardHeader>
              <CardTitle>{t("selectPosition")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="positionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("positionLabel")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("positionPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {election.positions.map((position) => (
                          <SelectItem key={position.id} value={position.id}>
                            {position.title} ({position.currentNominees}
                            {position.maxNominees && `/${position.maxNominees}`} {t("nomineesSuffix")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedPosition && (
                <Alert>
                  <AlertDescription>{selectedPosition.description}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Candidate Information */}
          {nominationType === "nominated" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("candidateInfo")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="candidateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("candidateLabel")}</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const member = members.find((m) => m.id === value);
                          if (member) {
                            field.onChange(value);
                            form.setValue("candidateName", member.name);
                            form.setValue("candidateEmail", member.email);
                          }
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("candidatePlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {members.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name} ({member.email})
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
          )}

          {/* Candidate Statement */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t("statementTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="statement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("statementLabel")}</FormLabel>
                    <FormDescription>
                      {t("statementHelp")}
                    </FormDescription>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={6}
                        placeholder={t("statementPlaceholder")}
                      />
                    </FormControl>
                    <div className="flex justify-between text-sm text-gray-500">
                      <FormMessage />
                      <span>
                        {field.value?.length || 0} / {election.maxStatementLength}
                      </span>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="qualifications"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("qualificationsLabel")}</FormLabel>
                    <FormDescription>
                      {t("qualificationsHelp")}
                    </FormDescription>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        placeholder={t("qualificationsPlaceholder")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="platformPoints"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("platformLabel")}</FormLabel>
                    <FormDescription>
                      {t("platformHelp")}
                    </FormDescription>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        placeholder={t("platformPlaceholder")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Seconder (if required) */}
          {election.requiresSeconder && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t("seconderTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    {t("seconderAlert")}
                  </AlertDescription>
                </Alert>

                <FormField
                  control={form.control}
                  name="seconderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("seconderLabel")}</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const member = members.find((m) => m.id === value);
                          if (member) {
                            field.onChange(value);
                            form.setValue("seconderName", member.name);
                            form.setValue("seconderEmail", member.email);
                          }
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("seconderPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {members
                            .filter((m) => m.id !== currentUser.id)
                            .map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name} ({member.email})
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
          )}

          {/* Supporting Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                {t("documentsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="documents">{t("documentsLabel")}</Label>
                <Input
                  id="documents"
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="mt-2"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
                <p className="text-sm text-gray-500 mt-1">
                  {t("documentsHelp")}
                </p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{file.name}</span>
                        <Badge variant="secondary">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        {t("documentsRemove")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Terms & Consent */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <FormField
                control={form.control}
                name="acceptedTerms"
                render={({ field }) => (
                  <FormItem className="flex items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        {t("termsAcceptLabel")}
                      </FormLabel>
                      <FormDescription>
                        {t("termsAcceptHelp")}
                      </FormDescription>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="consentToPublish"
                render={({ field }) => (
                  <FormItem className="flex items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>{t("consentLabel")}</FormLabel>
                      <FormDescription>
                        {t("consentHelp")}
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Button type="submit" disabled={!isNominationOpen || isLoading} className="flex-1">
              {isLoading ? (
                t("submitLoading")
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {t("submitButton")}
                </>
              )}
            </Button>
            <Button type="button" variant="outline" disabled={isLoading}>
              {t("draftButton")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

