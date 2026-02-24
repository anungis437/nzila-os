/**
 * Member Portal Dashboard
 * Member self-service portal homepage with personalized information
 */
"use client";


export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { 
  User, 
  FileText, 
  DollarSign,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface MemberStats {
  totalClaims: number;
  activeClaims: number;
  resolvedClaims: number;
  rejectedClaims: number;
  duesBalance?: number;
  nextDuesDate?: string;
  memberSince?: string;
  seniority?: string;
}

interface RecentClaim {
  claimId: string;
  claimNumber: string;
  claimType: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface Activity {
  id: string;
  type: 'claim_submitted' | 'claim_updated' | 'payment_made' | 'document_uploaded';
  title: string;
  description: string;
  timestamp: string;
}

export default function MemberPortalDashboard() {
  const { user } = useUser();
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [recentClaims, setRecentClaims] = useState<RecentClaim[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemberData = useCallback(async () => {
    try {
      // Fetch member stats and claims
      const [memberResponse, duesResponse] = await Promise.all([
        fetch('/api/members/me'),
        fetch('/api/portal/dues/balance')
      ]);

      if (memberResponse.ok) {
        const data = await memberResponse.json();
        setStats(data.stats);
        setRecentClaims(data.recentClaims || []);
      }

      // Integrate real dues balance from financial service
      if (duesResponse.ok) {
        const duesData = await duesResponse.json();
        setStats(prev => prev ? {
          ...prev,
          duesBalance: duesData.balance?.totalOwed || 0,
          nextDuesDate: duesData.balance?.nextDueDate || null
        } : null);
      }

      // Build activity feed from recent claims and transactions
      const activityItems: Activity[] = [];
      
      // Add recent claims to activity
      recentClaims.slice(0, 3).forEach(claim => {
        activityItems.push({
          id: claim.claimId,
          type: 'claim_submitted',
          title: `Claim ${claim.claimNumber} Submitted`,
          description: `${claim.claimType} - Status: ${claim.status}`,
          timestamp: claim.createdAt,
        });
      });

      setActivities(activityItems.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
    } catch (_error) {
} finally {
      setLoading(false);
    }
  }, [recentClaims]);

  useEffect(() => {
    fetchMemberData();
  }, [fetchMemberData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            Welcome back, {user?.firstName || user?.username || 'Member'}!
          </CardTitle>
          <CardDescription>
            Here&apos;s your union membership overview
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalClaims || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.activeClaims || 0} active
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Claim Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalClaims && stats.totalClaims > 0
                  ? Math.round((stats.resolvedClaims / stats.totalClaims) * 100)
                  : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.resolvedClaims || 0} resolved successfully
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dues Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats?.duesBalance?.toFixed(2) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.nextDuesDate ? `Next due: ${stats.nextDuesDate}` : 'Up to date'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Member Since</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.seniority || 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.memberSince || 'Membership date not set'}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/portal/claims/new">
              <Button className="w-full" size="lg">
                <FileText className="mr-2 h-5 w-5" />
                Submit New Claim
              </Button>
            </Link>
            <Link href="/portal/dues">
              <Button variant="outline" className="w-full" size="lg">
                <DollarSign className="mr-2 h-5 w-5" />
                View Dues
              </Button>
            </Link>
            <Link href="/portal/profile">
              <Button variant="outline" className="w-full" size="lg">
                <User className="mr-2 h-5 w-5" />
                Update Profile
              </Button>
            </Link>
            <Link href="/portal/documents">
              <Button variant="outline" className="w-full" size="lg">
                <FileText className="mr-2 h-5 w-5" />
                View Documents
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Claims */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Claims</CardTitle>
          <CardDescription>Your latest submissions and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {recentClaims.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No claims submitted yet</p>
              <Link href="/portal/claims/new">
                <Button className="mt-4">Submit Your First Claim</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentClaims.map((claim) => (
                <Link
                  key={claim.claimId}
                  href={`/portal/claims/${claim.claimId}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        claim.status === 'resolved' ? 'bg-green-100' :
                        claim.status === 'under-review' ? 'bg-blue-100' :
                        claim.status === 'rejected' ? 'bg-red-100' :
                        'bg-yellow-100'
                      }`}>
                        {claim.status === 'resolved' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : claim.status === 'rejected' ? (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{claim.claimNumber}</p>
                        <p className="text-sm text-gray-500">{claim.claimType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium capitalize">{claim.status.replace('-', ' ')}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(claim.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
              ))}
              <Link href="/portal/claims">
                <Button variant="outline" className="w-full">
                  View All Claims
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your recent actions and updates</CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="mx-auto h-10 w-10 mb-3 opacity-50" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className={`p-2 rounded-full ${
                    activity.type === 'claim_submitted' ? 'bg-blue-100' :
                    activity.type === 'claim_updated' ? 'bg-yellow-100' :
                    activity.type === 'payment_made' ? 'bg-green-100' :
                    'bg-purple-100'
                  }`}>
                    {activity.type === 'claim_submitted' || activity.type === 'claim_updated' ? (
                      <FileText className="h-4 w-4 text-blue-600" />
                    ) : activity.type === 'payment_made' ? (
                      <DollarSign className="h-4 w-4 text-green-600" />
                    ) : (
                      <FileText className="h-4 w-4 text-purple-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{activity.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
