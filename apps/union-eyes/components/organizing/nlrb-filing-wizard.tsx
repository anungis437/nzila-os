"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Upload,
  Calendar,
  Users,
  Scale,
  FileSignature,
  Building,
  ChevronRight,
  ChevronLeft,
  Download,
} from "lucide-react";

interface FilingData {
  // Step 1: Basic Information
  filingType: "nlrb_rc" | "nlrb_rm" | "clrb_certification" | "";
  jurisdiction: "federal" | "provincial" | "";
  filingNumber?: string;
  
  // Step 2: Bargaining Unit
  bargaingunUnitDescription: string;
  unitSizeClaimed: string;
  jobClassifications: string[];
  excludedPositions: string[];
  
  // Step 3: Showing of Interest
  showingOfInterestPercentage: string;
  cardsSubmittedCount: string;
  cardSubmissionBatchIds: string[];
  
  // Step 4: Election Details
  electionType: "mail" | "manual" | "electronic" | "mixed" | "";
  proposedElectionDate?: string;
  
  // Step 5: Employer Information
  employerName: string;
  employerAddress: string;
  employerRepresentation?: string;
  employerContested: boolean;
  employerObjections: string[];
}

const FILING_STEPS = [
  { id: 1, title: "Basic Information", icon: FileText },
  { id: 2, title: "Bargaining Unit", icon: Users },
  { id: 3, title: "Showing of Interest", icon: FileSignature },
  { id: 4, title: "Election Details", icon: Calendar },
  { id: 5, title: "Employer Information", icon: Building },
  { id: 6, title: "Review & Submit", icon: CheckCircle2 },
];

export default function NLRBFilingWizard({ campaignId, onComplete }: { campaignId: string; onComplete?: () => void }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [filingData, setFilingData] = useState<FilingData>({
    filingType: "",
    jurisdiction: "",
    bargaingunUnitDescription: "",
    unitSizeClaimed: "",
    jobClassifications: [],
    excludedPositions: [],
    showingOfInterestPercentage: "",
    cardsSubmittedCount: "",
    cardSubmissionBatchIds: [],
    electionType: "",
    employerName: "",
    employerAddress: "",
    employerContested: false,
    employerObjections: [],
  });

  const [newJobClassification, setNewJobClassification] = useState("");
  const [newExcludedPosition, setNewExcludedPosition] = useState("");
  const [newObjection, setNewObjection] = useState("");

  const handleNext = () => {
    if (currentStep < FILING_STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch('/api/organizing/nlrb-filings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          filingType: filingData.filingType,
          jurisdiction: filingData.jurisdiction,
          filedDate: new Date().toISOString(),
          bargainingUnitDescription: filingData.bargaingunUnitDescription,
          unitSizeClaimed: parseInt(filingData.unitSizeClaimed),
          jobClassifications: filingData.jobClassifications,
          excludedPositions: filingData.excludedPositions,
          showingOfInterestPercentage: filingData.showingOfInterestPercentage,
          cardsSubmittedCount: filingData.cardsSubmittedCount ? parseInt(filingData.cardsSubmittedCount) : undefined,
          cardSubmissionBatchIds: filingData.cardSubmissionBatchIds,
          electionType: filingData.electionType || undefined,
          proposedElectionDate: filingData.proposedElectionDate,
          employerName: filingData.employerName,
          employerAddress: filingData.employerAddress,
          employerRepresentation: filingData.employerRepresentation,
          employerContested: filingData.employerContested,
          employerObjections: filingData.employerObjections,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit filing');
      }

      const _result = await response.json();
if (onComplete) onComplete();
    } catch (error) {
alert(`Failed to submit filing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const addJobClassification = () => {
    if (newJobClassification.trim()) {
      setFilingData({
        ...filingData,
        jobClassifications: [...filingData.jobClassifications, newJobClassification.trim()],
      });
      setNewJobClassification("");
    }
  };

  const removeJobClassification = (index: number) => {
    setFilingData({
      ...filingData,
      jobClassifications: filingData.jobClassifications.filter((_, i) => i !== index),
    });
  };

  const addExcludedPosition = () => {
    if (newExcludedPosition.trim()) {
      setFilingData({
        ...filingData,
        excludedPositions: [...filingData.excludedPositions, newExcludedPosition.trim()],
      });
      setNewExcludedPosition("");
    }
  };

  const removeExcludedPosition = (index: number) => {
    setFilingData({
      ...filingData,
      excludedPositions: filingData.excludedPositions.filter((_, i) => i !== index),
    });
  };

  const addObjection = () => {
    if (newObjection.trim()) {
      setFilingData({
        ...filingData,
        employerObjections: [...filingData.employerObjections, newObjection.trim()],
      });
      setNewObjection("");
    }
  };

  const removeObjection = (index: number) => {
    setFilingData({
      ...filingData,
      employerObjections: filingData.employerObjections.filter((_, i) => i !== index),
    });
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!filingData.filingType && !!filingData.jurisdiction;
      case 2:
        return !!filingData.bargaingunUnitDescription && !!filingData.unitSizeClaimed && filingData.jobClassifications.length > 0;
      case 3:
        return !!filingData.showingOfInterestPercentage && !!filingData.cardsSubmittedCount;
      case 4:
        return !!filingData.electionType;
      case 5:
        return !!filingData.employerName && !!filingData.employerAddress;
      default:
        return true;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {FILING_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isCompleted
                          ? "bg-green-600 border-green-600 text-white"
                          : isActive
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-gray-300 text-gray-400"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <span
                      className={`text-xs mt-2 text-center hidden sm:block ${
                        isActive ? "font-semibold text-blue-600" : "text-muted-foreground"
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < FILING_STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${
                        isCompleted ? "bg-green-600" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{FILING_STEPS[currentStep - 1].title}</CardTitle>
          <CardDescription>Complete the required information for this step</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="filingType">Filing Type *</Label>
                <Select
                  value={filingData.filingType}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onValueChange={(value: any) => setFilingData({ ...filingData, filingType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select filing type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nlrb_rc">NLRB Petition (RC - Representation Certification)</SelectItem>
                    <SelectItem value="nlrb_rm">NLRB Petition (RM - Representation Decertification)</SelectItem>
                    <SelectItem value="clrb_certification">CLRB Certification Application</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  RC: Union seeks certification | RM: Employer seeks decertification | CLRB: Canadian certification
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jurisdiction">Jurisdiction *</Label>
                <Select
                  value={filingData.jurisdiction}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onValueChange={(value: any) => setFilingData({ ...filingData, jurisdiction: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select jurisdiction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="federal">Federal (NLRB/CLRB)</SelectItem>
                    <SelectItem value="provincial">Provincial (Canada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filingNumber">Filing Number (Optional)</Label>
                <Input
                  id="filingNumber"
                  placeholder="e.g., 01-RC-123456"
                  value={filingData.filingNumber || ""}
                  onChange={(e) => setFilingData({ ...filingData, filingNumber: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank if not yet assigned. Will be provided by NLRB/CLRB after filing.
                </p>
              </div>

              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Filing Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <p>â€¢ NLRB RC: Requires 30% showing of interest</p>
                  <p>â€¢ NLRB RM: Employer must provide proof of doubt</p>
                  <p>â€¢ CLRB: Typically requires 40-55% depending on province</p>
                  <p>â€¢ All filings require accurate bargaining unit description</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Bargaining Unit */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="unitDescription">Bargaining Unit Description *</Label>
                <Textarea
                  id="unitDescription"
                  placeholder="Describe the proposed bargaining unit (e.g., All full-time and part-time production workers...)"
                  value={filingData.bargaingunUnitDescription}
                  onChange={(e) => setFilingData({ ...filingData, bargaingunUnitDescription: e.target.value })}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Be specific and inclusive. This will appear on official documents.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitSize">Unit Size (Number of Employees) *</Label>
                <Input
                  id="unitSize"
                  type="number"
                  placeholder="250"
                  value={filingData.unitSizeClaimed}
                  onChange={(e) => setFilingData({ ...filingData, unitSizeClaimed: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Job Classifications in Unit *</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Production Worker, Assembler"
                    value={newJobClassification}
                    onChange={(e) => setNewJobClassification(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addJobClassification())}
                  />
                  <Button onClick={addJobClassification} type="button">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {filingData.jobClassifications.map((classification, index) => (
                    <Badge key={index} variant="secondary" className="pr-1">
                      {classification}
                      <button
                        onClick={() => removeJobClassification(index)}
                        className="ml-2 hover:text-destructive"
                      >
                        Ã—
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Excluded Positions (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Supervisors, Managers, Confidential"
                    value={newExcludedPosition}
                    onChange={(e) => setNewExcludedPosition(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExcludedPosition())}
                  />
                  <Button onClick={addExcludedPosition} type="button" variant="outline">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {filingData.excludedPositions.map((position, index) => (
                    <Badge key={index} variant="outline" className="pr-1">
                      {position}
                      <button
                        onClick={() => removeExcludedPosition(index)}
                        className="ml-2 hover:text-destructive"
                      >
                        Ã—
                      </button>
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Typically excludes supervisors, managers, and confidential employees
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Showing of Interest */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="showingPercentage">Showing of Interest Percentage *</Label>
                <Input
                  id="showingPercentage"
                  type="number"
                  placeholder="50"
                  min="30"
                  max="100"
                  value={filingData.showingOfInterestPercentage}
                  onChange={(e) => setFilingData({ ...filingData, showingOfInterestPercentage: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 30% for NLRB, typically 40-55% for CLRB (varies by province)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardsCount">Number of Authorization Cards Submitted *</Label>
                <Input
                  id="cardsCount"
                  type="number"
                  placeholder="125"
                  value={filingData.cardsSubmittedCount}
                  onChange={(e) => setFilingData({ ...filingData, cardsSubmittedCount: e.target.value })}
                />
              </div>

              {filingData.unitSizeClaimed && filingData.cardsSubmittedCount && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Calculated Percentage</p>
                        <p className="text-xs text-muted-foreground">Based on unit size and cards submitted</p>
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {((parseInt(filingData.cardsSubmittedCount) / parseInt(filingData.unitSizeClaimed)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <Label>Card Submission Documentation</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload scanned authorization cards or card submission receipts
                  </p>
                  <Button variant="outline" size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Files
                  </Button>
                </div>
              </div>

              <Card className="bg-orange-50 border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Scale className="w-4 h-4" />
                    Legal Note
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs">
                  <p>
                    Authorization cards must be current (typically within 12 months), voluntarily signed, and meet all legal requirements. Cards with legal issues will not be counted toward showing of interest.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 4: Election Details */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="electionType">Proposed Election Type *</Label>
                <Select
                  value={filingData.electionType}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onValueChange={(value: any) => setFilingData({ ...filingData, electionType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select election type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Ballot (On-Site Voting)</SelectItem>
                    <SelectItem value="mail">Mail Ballot</SelectItem>
                    <SelectItem value="electronic">Electronic Voting</SelectItem>
                    <SelectItem value="mixed">Mixed Methods</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proposedDate">Proposed Election Date (Optional)</Label>
                <Input
                  id="proposedDate"
                  type="date"
                  value={filingData.proposedElectionDate || ""}
                  onChange={(e) => setFilingData({ ...filingData, proposedElectionDate: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  NLRB/CLRB will schedule the election. This is your preferred date.
                </p>
              </div>

              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Election Type Guidance</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <div>
                    <p className="font-semibold">Manual Ballot:</p>
                    <p className="text-muted-foreground">
                      Traditional on-site voting. Best for concentrated workforces. Typically scheduled 21-42 days after filing.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Mail Ballot:</p>
                    <p className="text-muted-foreground">
                      Used for dispersed workforces or shift work. Longer timeline (30-60 days).
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Electronic:</p>
                    <p className="text-muted-foreground">
                      Modern option, requires NLRB/CLRB approval. Not available in all jurisdictions.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 5: Employer Information */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employerName">Employer Legal Name *</Label>
                <Input
                  id="employerName"
                  placeholder="Acme Manufacturing Inc."
                  value={filingData.employerName}
                  onChange={(e) => setFilingData({ ...filingData, employerName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employerAddress">Employer Address *</Label>
                <Textarea
                  id="employerAddress"
                  placeholder="Full business address including city, state/province, postal code"
                  value={filingData.employerAddress}
                  onChange={(e) => setFilingData({ ...filingData, employerAddress: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employerRep">Employer Legal Representation (Optional)</Label>
                <Input
                  id="employerRep"
                  placeholder="Law firm or attorney name"
                  value={filingData.employerRepresentation || ""}
                  onChange={(e) => setFilingData({ ...filingData, employerRepresentation: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="contested"
                  checked={filingData.employerContested}
                  onCheckedChange={(checked) =>
                    setFilingData({ ...filingData, employerContested: checked as boolean })
                  }
                />
                <label htmlFor="contested" className="text-sm font-medium">
                  Employer has indicated they will contest this filing
                </label>
              </div>

              {filingData.employerContested && (
                <div className="space-y-2">
                  <Label>Employer Objections</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Disputes unit composition, Claims supervisory exclusions"
                      value={newObjection}
                      onChange={(e) => setNewObjection(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addObjection())}
                    />
                    <Button onClick={addObjection} type="button" variant="outline">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {filingData.employerObjections.map((objection, index) => (
                      <Badge key={index} variant="destructive" className="pr-1">
                        {objection}
                        <button
                          onClick={() => removeObjection(index)}
                          className="ml-2 hover:opacity-70"
                        >
                          Ã—
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Review & Submit */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Filing Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-semibold text-muted-foreground">Filing Type</p>
                    <p>{filingData.filingType.replace("_", " ").toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground">Jurisdiction</p>
                    <p className="capitalize">{filingData.jurisdiction}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground">Bargaining Unit</p>
                    <p>{filingData.bargaingunUnitDescription}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold text-muted-foreground">Unit Size</p>
                      <p>{filingData.unitSizeClaimed} employees</p>
                    </div>
                    <div>
                      <p className="font-semibold text-muted-foreground">Cards Submitted</p>
                      <p>{filingData.cardsSubmittedCount} cards ({filingData.showingOfInterestPercentage}%)</p>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground">Job Classifications</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {filingData.jobClassifications.map((classification, i) => (
                        <Badge key={i} variant="secondary">{classification}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground">Employer</p>
                    <p>{filingData.employerName}</p>
                    <p className="text-xs text-muted-foreground">{filingData.employerAddress}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground">Election Type</p>
                    <p className="capitalize">{filingData.electionType.replace("_", " ")}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-green-50 border-green-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Ready to File
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <p>Your petition is complete and ready to submit to the NLRB/CLRB.</p>
                  <p className="font-semibold">Next Steps After Filing:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>You will receive a filing number (typically within 1-3 business days)</li>
                    <li>NLRB/CLRB will review your showing of interest</li>
                    <li>Employer will be notified and may contest</li>
                    <li>Pre-election hearing may be scheduled if contested</li>
                    <li>Election date will be set (typically 21-42 days after filing)</li>
                  </ul>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Download Petition PDF
                </Button>
                <Button variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Download Supporting Docs
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            {currentStep < FILING_STEPS.length ? (
              <Button onClick={handleNext} disabled={!isStepValid(currentStep)}>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
                <FileText className="w-4 h-4 mr-2" />
                Submit Filing to NLRB/CLRB
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

