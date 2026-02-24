/**
 * Vote Verification System Component
 * 
 * Secure vote verification with:
 * - Receipt generation
 * - Verification codes
 * - Vote confirmation
 * - Anonymity protection
 * - Audit trail
 * - Verification lookup
 * 
 * @module components/voting/vote-verification-system
 */

"use client";

import * as React from "react";
import {
  CheckCircle2,
  Shield,
  Key,
  Download,
  Mail,
  Copy,
  Eye,
  AlertCircle,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

export interface VoteReceipt {
  verificationCode: string;
  electionId: string;
  electionTitle: string;
  ballotId: string;
  timestamp: Date;
  status: "confirmed" | "pending" | "rejected";
  questions: {
    id: string;
    title: string;
    answerHash: string; // Hash to verify without revealing choice
  }[];
  voter: {
    memberId: string;
    memberName: string;
    memberEmail: string;
  };
}

export interface VerificationStatus {
  isValid: boolean;
  receipt?: VoteReceipt;
  error?: string;
}

export interface VoteVerificationSystemProps {
  receipt?: VoteReceipt;
  onVerify?: (code: string) => Promise<VerificationStatus>;
  onDownloadReceipt?: (receipt: VoteReceipt) => void;
  onEmailReceipt?: (receipt: VoteReceipt) => Promise<void>;
}

export function VoteVerificationSystem({
  receipt,
  onVerify,
  onDownloadReceipt,
  onEmailReceipt,
}: VoteVerificationSystemProps) {
  const [verificationCode, setVerificationCode] = React.useState("");
  const [verificationResult, setVerificationResult] = React.useState<VerificationStatus | null>(
    null
  );
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleVerify = async () => {
    if (!onVerify || !verificationCode) return;

    setIsVerifying(true);
    try {
      const result = await onVerify(verificationCode);
      setVerificationResult(result);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopyCode = () => {
    if (!receipt) return;
    navigator.clipboard.writeText(receipt.verificationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!receipt || !onDownloadReceipt) return;
    onDownloadReceipt(receipt);
  };

  const handleEmail = async () => {
    if (!receipt || !onEmailReceipt) return;
    await onEmailReceipt(receipt);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue={receipt ? "receipt" : "verify"} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="receipt" disabled={!receipt}>
            My Receipt
          </TabsTrigger>
          <TabsTrigger value="verify">Verify Vote</TabsTrigger>
        </TabsList>

        {/* Receipt Tab */}
        <TabsContent value="receipt" className="space-y-4">
          {receipt ? (
            <>
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Your vote has been successfully recorded and verified.
                </AlertDescription>
              </Alert>

              <VoteReceiptCard receipt={receipt} />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Verification Code
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Your Unique Verification Code</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={receipt.verificationCode}
                        readOnly
                        className="font-mono text-lg"
                      />
                      <Button variant="outline" onClick={handleCopyCode}>
                        {copied ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Save this code to verify your vote was counted. Your vote remains
                      anonymous.
                    </p>
                  </div>

                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Important:</strong> This code verifies your vote was recorded
                      without revealing how you voted. Keep it safe to confirm your vote
                      after the election.
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-2">
                    <Button onClick={handleDownload} variant="outline" className="flex-1">
                      <Download className="h-4 w-4 mr-2" />
                      Download Receipt
                    </Button>
                    <Button onClick={handleEmail} variant="outline" className="flex-1">
                      <Mail className="h-4 w-4 mr-2" />
                      Email Receipt
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <SecurityNotice />
            </>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No receipt available. Complete a vote to receive your verification code.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Verify Tab */}
        <TabsContent value="verify" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Verify Your Vote
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="verificationCode">Enter Verification Code</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="verificationCode"
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                    className="font-mono"
                  />
                  <Button onClick={handleVerify} disabled={!verificationCode || isVerifying}>
                    {isVerifying ? "Verifying..." : "Verify"}
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Enter the verification code from your vote receipt to confirm your vote
                  was recorded.
                </p>
              </div>

              {verificationResult && (
                <div className="mt-4">
                  {verificationResult.isValid && verificationResult.receipt ? (
                    <>
                      <Alert className="border-green-200 bg-green-50 mb-4">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          ✓ Vote verified successfully
                        </AlertDescription>
                      </Alert>
                      <VoteReceiptCard receipt={verificationResult.receipt} />
                    </>
                  ) : (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {verificationResult.error || "Invalid verification code"}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  Vote verification confirms your vote was recorded without revealing your
                  choices. Your ballot remains completely anonymous.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <SecurityNotice />

          <FAQSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VoteReceiptCard({ receipt }: { receipt: VoteReceipt }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{receipt.electionTitle}</CardTitle>
            <p className="text-sm text-gray-600 mt-1">Ballot ID: {receipt.ballotId}</p>
          </div>
          <Badge
            variant={
              receipt.status === "confirmed"
                ? "success"
                : receipt.status === "pending"
                ? "default"
                : "destructive"
            }
          >
            {receipt.status === "confirmed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {receipt.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-gray-600">Voter</Label>
            <div className="font-medium mt-1">{receipt.voter.memberName}</div>
          </div>
          <div>
            <Label className="text-gray-600">Submitted</Label>
            <div className="font-medium mt-1">
              {format(receipt.timestamp, "PPp")}
            </div>
          </div>
        </div>

        <div>
          <Label className="text-gray-600">Questions Answered</Label>
          <div className="mt-2 space-y-2">
            {receipt.questions.map((question) => (
              <div key={question.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-sm">{question.title}</div>
                  <div className="text-xs text-gray-500 mt-1 font-mono">
                    Hash: {question.answerHash.substring(0, 16)}...
                  </div>
                </div>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
            ))}
          </div>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Answer hashes verify your responses were recorded without revealing your votes.
            Only you can match these hashes to your actual choices.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function SecurityNotice() {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="pt-6">
        <div className="flex gap-3">
          <Shield className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h4 className="font-semibold text-blue-900">Privacy & Security</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Your verification code confirms your vote without revealing choices</li>
              <li>• Votes are encrypted and anonymized before storage</li>
              <li>• No one can connect your code to how you voted</li>
              <li>• Keep your code private - it&apos;s your proof of participation</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FAQSection() {
  const faqs = [
    {
      question: "What is a verification code?",
      answer:
        "A unique code that proves your vote was recorded without revealing how you voted.",
    },
    {
      question: "Can others see how I voted?",
      answer:
        "No. The verification system confirms your vote exists but keeps your choices completely anonymous.",
    },
    {
      question: "When can I verify my vote?",
      answer:
        "You can verify your vote immediately after submission and at any time until results are finalized.",
    },
    {
      question: "What if my code doesn&apos;t work?",
      answer:
        "Contact election administrators if your verification code shows invalid. Keep your email receipt as backup proof.",
    },
    {
      question: "Can I change my vote after getting a code?",
      answer:
        "This depends on election rules. Some elections allow vote changes before closing, others do not.",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Frequently Asked Questions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="border-b last:border-0 pb-4 last:pb-0">
              <h4 className="font-medium mb-2">{faq.question}</h4>
              <p className="text-sm text-gray-600">{faq.answer}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

