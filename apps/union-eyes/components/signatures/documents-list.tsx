/**
 * Signature Documents List Component
 * Display user's signature documents
 */

"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Download,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Document {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  fileName: string;
}

interface DocumentsListProps {
  organizationId: string;
}

export function DocumentsList({ organizationId }: DocumentsListProps) {
  const [documents, setDocuments] = useState<{
    sent: Document[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toSign: any[];
  }>({ sent: [], toSign: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const loadDocuments = async () => {
    try {
      const response = await fetch(
        `/api/signatures/documents?organizationId=${organizationId}`
      );
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { variant: any; icon: any; label: string }
    > = {
      sent: {
        variant: "default",
        icon: Clock,
        label: "Sent",
      },
      viewed: {
        variant: "secondary",
        icon: Eye,
        label: "Viewed",
      },
      signed: {
        variant: "default",
        icon: CheckCircle,
        label: "Signed",
      },
      completed: {
        variant: "success",
        icon: CheckCircle,
        label: "Completed",
      },
      declined: {
        variant: "destructive",
        icon: XCircle,
        label: "Declined",
      },
      voided: {
        variant: "secondary",
        icon: XCircle,
        label: "Voided",
      },
      expired: {
        variant: "secondary",
        icon: Clock,
        label: "Expired",
      },
    };

    const config = variants[status] || variants.sent;
    const Icon = config.icon;

    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <Badge variant={config.variant as any}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading documents...</div>;
  }

  return (
    <Tabs defaultValue="sent" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="sent">
          Sent by Me ({documents.sent.length})
        </TabsTrigger>
        <TabsTrigger value="toSign">
          To Sign ({documents.toSign.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sent" className="space-y-4">
        {documents.sent.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No documents sent yet</p>
            </CardContent>
          </Card>
        ) : (
          documents.sent.map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{doc.title}</CardTitle>
                    <CardDescription>
                      {doc.fileName} â€¢{" "}
                      {formatDistanceToNow(new Date(doc.createdAt), {
                        addSuffix: true,
                      })}
                    </CardDescription>
                  </div>
                  {getStatusBadge(doc.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/signatures/documents/${doc.id}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </a>
                  </Button>
                  {doc.status === "completed" && (
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>

      <TabsContent value="toSign" className="space-y-4">
        {documents.toSign.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No documents awaiting your signature</p>
            </CardContent>
          </Card>
        ) : (
          documents.toSign.map(({ document, signer }) => (
            <Card key={document.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{document.title}</CardTitle>
                    <CardDescription>
                      {document.fileName} â€¢{" "}
                      {formatDistanceToNow(new Date(document.createdAt), {
                        addSuffix: true,
                      })}
                    </CardDescription>
                  </div>
                  {getStatusBadge(signer.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {signer.status === "pending" ||
                  signer.status === "sent" ||
                  signer.status === "viewed" ? (
                    <Button size="sm" asChild>
                      <a href={`/sign/${document.id}?signer=${signer.id}`}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Sign Document
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/signatures/documents/${document.id}`}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}

