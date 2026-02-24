/**
 * Claim Detail Page
 * View details of a specific claim
 */
"use client";


export const dynamic = 'force-dynamic';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft,
  CheckCircle, 
  AlertCircle, 
  Clock,
  FileText,
  Calendar,
  MapPin,
  Users
} from "lucide-react";

interface ClaimDetail {
  claimId: string;
  claimNumber: string;
  claimType: string;
  status: string;
  priority: string;
  description: string;
  incidentDate: string;
  location?: string;
  witnesses?: string;
  createdAt: string;
  updatedAt: string;
  resolution?: string;
  resolutionDate?: string;
}

export default function ClaimDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClaim() {
      try {
        const response = await fetch(`/api/claims/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setClaim(data);
        }
      } catch (_error) {
} finally {
        setLoading(false);
      }
    }

    fetchClaim();
  }, [params.id]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'rejected':
        return <AlertCircle className="h-6 w-6 text-red-600" />;
      default:
        return <Clock className="h-6 w-6 text-blue-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'under-review':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!claim) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">Claim not found</p>
          <Button onClick={() => router.push('../claims')}>
            Back to Claims
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push('../claims')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Claims
      </Button>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {getStatusIcon(claim.status)}
              <div>
                <CardTitle>{claim.claimNumber}</CardTitle>
                <CardDescription>{claim.claimType}</CardDescription>
              </div>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(claim.status)}`}>
              {claim.status}
            </span>
          </div>
        </CardHeader>
      </Card>

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Claim Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Calendar className="h-4 w-4" />
                <span>Incident Date</span>
              </div>
              <p className="font-medium">
                {new Date(claim.incidentDate).toLocaleDateString()}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Calendar className="h-4 w-4" />
                <span>Submitted</span>
              </div>
              <p className="font-medium">
                {new Date(claim.createdAt).toLocaleDateString()}
              </p>
            </div>

            {claim.location && (
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <MapPin className="h-4 w-4" />
                  <span>Location</span>
                </div>
                <p className="font-medium">{claim.location}</p>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <FileText className="h-4 w-4" />
                <span>Priority</span>
              </div>
              <p className="font-medium capitalize">{claim.priority}</p>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Description</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{claim.description}</p>
          </div>

          {claim.witnesses && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-gray-600" />
                <h3 className="font-medium">Witnesses</h3>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{claim.witnesses}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolution Card */}
      {(claim.status === 'resolved' || claim.status === 'rejected') && claim.resolution && (
        <Card>
          <CardHeader>
            <CardTitle>Resolution</CardTitle>
            {claim.resolutionDate && (
              <CardDescription>
                Resolved on {new Date(claim.resolutionDate).toLocaleDateString()}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{claim.resolution}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
