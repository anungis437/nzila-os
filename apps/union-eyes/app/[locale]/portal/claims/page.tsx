/**
 * Member Claims List Page
 * View all claims submitted by the member
 */
"use client";


export const dynamic = 'force-dynamic';
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
 
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  FileText,
  Plus,
  Search
} from "lucide-react";

interface Claim {
  claimId: string;
  claimNumber: string;
  claimType: string;
  status: string;
  priority: string;
  createdAt: string;
}

export default function MemberClaimsPage() {
  const { user: _user } = useUser();
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchClaims() {
      try {
        const response = await fetch('/api/members/me');
        if (response.ok) {
          const data = await response.json();
          setClaims(data.recentClaims || []);
        }
      } catch (_error) {
} finally {
        setLoading(false);
      }
    }

    fetchClaims();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-blue-600" />;
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

  const filteredClaims = claims.filter(claim =>
    claim.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.claimType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>My Claims</CardTitle>
            <CardDescription>View and track your submitted claims</CardDescription>
          </div>
          <Button onClick={() => router.push('./claims/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Submit New Claim
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search claims by number or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Claims List */}
      {filteredClaims.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'No claims match your search' : 'No claims submitted yet'}
            </p>
            {!searchTerm && (
              <Button onClick={() => router.push('./claims/new')}>
                Submit Your First Claim
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredClaims.map((claim) => (
            <Card
              key={claim.claimId}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`./claims/${claim.claimId}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(claim.status)}
                    <div>
                      <p className="font-medium">{claim.claimNumber}</p>
                      <p className="text-sm text-gray-600">{claim.claimType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(claim.status)}`}>
                      {claim.status}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
