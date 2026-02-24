/**
 * Signature Request Form Component
 * Upload document and request signatures from multiple recipients
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Trash2, Send } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

interface Signer {
  id: string;
  email: string;
  name: string;
  role?: string;
  signingOrder: number;
}

interface SignatureRequestFormProps {
  organizationId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess?: (document: any) => void;
}

export function SignatureRequestForm({
  organizationId,
  onSuccess,
}: SignatureRequestFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentType, setDocumentType] = useState("contract");
  const [provider, setProvider] = useState("internal");
  const [expirationDays, setExpirationDays] = useState("30");
  const [sequentialSigning, _setSequentialSigning] = useState(false);
  const [signers, setSigners] = useState<Signer[]>([
    { id: "1", email: "", name: "", signingOrder: 1 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const addSigner = () => {
    setSigners([
      ...signers,
      {
        id: Date.now().toString(),
        email: "",
        name: "",
        signingOrder: signers.length + 1,
      },
    ]);
  };

  const removeSigner = (id: string) => {
    if (signers.length > 1) {
      setSigners(signers.filter((s) => s.id !== id));
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateSigner = (id: string, field: keyof Signer, value: any) => {
    setSigners(
      signers.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      toast({
        title: "Error",
        description: "Please upload a document",
        variant: "destructive",
      });
      return;
    }

    if (!title) {
      toast({
        title: "Error",
        description: "Please enter a document title",
        variant: "destructive",
      });
      return;
    }

    const invalidSigners = signers.filter((s) => !s.email || !s.name);
    if (invalidSigners.length > 0) {
      toast({
        title: "Error",
        description: "Please fill in all signer details",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("documentType", documentType);
      formData.append("organizationId", organizationId);
      formData.append("signers", JSON.stringify(signers));
      formData.append("provider", provider);
      formData.append("expirationDays", expirationDays);
      formData.append("sequentialSigning", String(sequentialSigning));

      const response = await fetch("/api/signatures/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to create signature request");
      }

      const result = await response.json();

      toast({
        title: "Success",
        description: "Document sent for signature",
      });

      // Reset form
      setFile(null);
      setTitle("");
      setDescription("");
      setSigners([{ id: "1", email: "", name: "", signingOrder: 1 }]);

      if (onSuccess) {
        onSuccess(result.document);
      }
    } catch (_error) {
toast({
        title: "Error",
        description: "Failed to send document for signature",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Document Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Document</CardTitle>
          <CardDescription>
            Upload the document that requires signatures
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="file">Document File (PDF recommended)</Label>
            <div className="mt-2">
              <Input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
            </div>
            {file && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span>{file.name}</span>
                <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="title">Document Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Employment Contract"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any context or instructions for signers"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="documentType">Document Type</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="agreement">Agreement</SelectItem>
                  <SelectItem value="form">Form</SelectItem>
                  <SelectItem value="authorization">Authorization</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="provider">Signature Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal (Simple)</SelectItem>
                  <SelectItem value="docusign">DocuSign</SelectItem>
                  <SelectItem value="hellosign">HelloSign</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="expiration">Expiration (Days)</Label>
            <Input
              id="expiration"
              type="number"
              value={expirationDays}
              onChange={(e) => setExpirationDays(e.target.value)}
              min="1"
              max="365"
            />
          </div>
        </CardContent>
      </Card>

      {/* Signers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Signers</span>
            <Button type="button" variant="outline" size="sm" onClick={addSigner}>
              <Plus className="w-4 h-4 mr-2" />
              Add Signer
            </Button>
          </CardTitle>
          <CardDescription>
            Add the people who need to sign this document
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {signers.map((signer, _index) => (
            <div
              key={signer.id}
              className="flex gap-4 p-4 border rounded-lg bg-muted/30"
            >
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={signer.name}
                      onChange={(e) =>
                        updateSigner(signer.id, "name", e.target.value)
                      }
                      placeholder="Full Name"
                      required
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={signer.email}
                      onChange={(e) =>
                        updateSigner(signer.id, "email", e.target.value)
                      }
                      placeholder="email@example.com"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Role (Optional)</Label>
                    <Input
                      value={signer.role || ""}
                      onChange={(e) =>
                        updateSigner(signer.id, "role", e.target.value)
                      }
                      placeholder="e.g., Employee, Manager"
                    />
                  </div>
                  <div>
                    <Label>Signing Order</Label>
                    <Input
                      type="number"
                      value={signer.signingOrder}
                      onChange={(e) =>
                        updateSigner(
                          signer.id,
                          "signingOrder",
                          parseInt(e.target.value)
                        )
                      }
                      min="1"
                    />
                  </div>
                </div>
              </div>
              {signers.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSigner(signer.id)}
                  className="self-start"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            "Sending..."
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send for Signature
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

