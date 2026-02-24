'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import TrusteePortal from '@/components/pension/TrusteePortal';
import { Shield, AlertCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TrusteePortalPage() {
  const [loading, setLoading] = useState(true);
  const [isTrustee, setIsTrustee] = useState(false);
  const [trustBoardId, setTrustBoardId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkTrusteeStatus();
  }, []);

  const checkTrusteeStatus = async () => {
    try {
      setLoading(true);
      
      // In production, fetch current user's trustee status
      // For now, check if user has trustee role or is assigned to a trust board
      
      // Mock check - replace with actual API call
      const response = await fetch('/api/pension/trustees?activeOnly=true');
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if current user is a trustee
        if (data.data && data.data.length > 0) {
          const userTrustee = data.data[0]; // Get first trustee record for user
          setIsTrustee(true);
          setTrustBoardId(userTrustee.trusteeBoardId);
          setMemberId(userTrustee.userId);
        } else {
          setIsTrustee(false);
        }
      }
    } catch (_err) {
setError('Unable to verify trustee status. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-100">
          <div className="text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Verifying trustee credentials...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="w-8 h-8" />
              Pension Trustee Portal
            </h1>
            <p className="text-muted-foreground mt-1">
              Joint labor-management pension board governance
            </p>
          </div>
        </div>

        <Card className="border-2 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-600" />
              <h3 className="text-xl font-semibold mb-2 text-red-900">Error Loading Portal</h3>
              <p className="text-red-800 mb-4 max-w-md mx-auto">{error}</p>
              <Button variant="outline" onClick={() => checkTrusteeStatus()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isTrustee || !trustBoardId || !memberId) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="w-8 h-8" />
              Pension Trustee Portal
            </h1>
            <p className="text-muted-foreground mt-1">
              Joint labor-management pension board governance
            </p>
          </div>
        </div>

        <Card className="border-2 border-dashed bg-muted/50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">Trustee Access Required</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                You are not currently appointed as a pension trustee. This portal is restricted
                to appointed trustees serving on joint labor-management pension boards.
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>For Labor Trustees:</strong> You must be appointed by your union to serve on a pension board.</p>
                <p><strong>For Management Trustees:</strong> You must be appointed by participating employers.</p>
                <p><strong>For Independent Trustees:</strong> You must be appointed by the joint board.</p>
              </div>
              <div className="mt-6">
                <Button variant="outline">
                  Contact Union Office for Information
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Information about Trustee Responsibilities */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Trustee Responsibilities</h3>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <p>Fiduciary duty to plan members and beneficiaries</p>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <p>Oversight of plan investments and asset management</p>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <p>Review and approval of benefit claims and distributions</p>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <p>Ensure compliance with pension legislation and regulations</p>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <p>Regular meeting attendance and participation in governance decisions</p>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <p>Review of actuarial valuations and funding requirements</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is a trustee - render full portal
  return (
    <div className="p-6">
      <TrusteePortal trustBoardId={trustBoardId} memberId={memberId} />
    </div>
  );
}
