export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getTranslations } from 'next-intl/server';
import { Leaderboard } from '@/components/rewards/leaderboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { sql } from 'drizzle-orm';
import { recognitionAwards, rewardWalletLedger } from '@/db/schema/recognition-rewards-schema';

export const metadata: Metadata = {
  title: 'Leaderboard | Recognition & Rewards',
  description: 'Top performers and recognizers in the organization',
};

async function getLeaderboardData(orgId: string, period: 'all-time' | 'monthly' | 'weekly' = 'monthly') {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'weekly':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(0); // All time
  }

  // Top receivers query
  const topReceiversQuery = sql`
    SELECT 
      rwl.user_id,
      om.user_name as name,
      u.avatar_url as avatar,
      SUM(CASE WHEN rwl.event_type = 'earn' THEN rwl.amount ELSE 0 END) as total_credits,
      COUNT(DISTINCT rwl.id) as awards_received,
      RANK() OVER (ORDER BY SUM(CASE WHEN rwl.event_type = 'earn' THEN rwl.amount ELSE 0 END) DESC) as rank
    FROM ${rewardWalletLedger} rwl
    LEFT JOIN organization_members om ON om.user_id = rwl.user_id
    LEFT JOIN users u ON u.id = rwl.user_id
    WHERE rwl.org_id = ${orgId}
      AND rwl.created_at >= ${startDate}
      AND rwl.event_type = 'earn'
    GROUP BY rwl.user_id, om.user_name, u.avatar_url
    ORDER BY total_credits DESC
    LIMIT 20
  `;

  // Top givers query
  const topGiversQuery = sql`
    SELECT 
      ra.issuer_user_id as user_id,
      om.user_name as name,
      u.avatar_url as avatar,
      SUM(ra.credits_awarded) as total_credits,
      COUNT(ra.id) as awards_given,
      RANK() OVER (ORDER BY COUNT(ra.id) DESC) as rank
    FROM ${recognitionAwards} ra
    LEFT JOIN organization_members om ON om.user_id = ra.issuer_user_id
    LEFT JOIN users u ON u.id = ra.issuer_user_id
    WHERE ra.org_id = ${orgId}
      AND ra.created_at >= ${startDate}
      AND ra.status = 'issued'
    GROUP BY ra.issuer_user_id, om.user_name, u.avatar_url
    ORDER BY awards_given DESC
    LIMIT 20
  `;

  // NzilaOS: All DB queries wrapped in RLS context for org isolation (PR-UE-01)
  const { topReceivers, topGivers } = await withRLSContext(async (tx) => {
    const topReceivers = await tx.execute(topReceiversQuery);
    const topGivers = await tx.execute(topGiversQuery);
    return { topReceivers, topGivers };
  });

  return {
    topReceivers: (topReceivers as Array<Record<string, unknown>>).map((row) => ({
      userId: String(row.user_id),
      name: String(row.name || 'Unknown User'),
      avatar: row.avatar as string | undefined,
      totalCredits: Number(row.total_credits),
      awardsReceived: Number(row.awards_received),
      rank: Number(row.rank),
    })),
    topGivers: (topGivers as Array<Record<string, unknown>>).map((row) => ({
      userId: String(row.user_id),
      name: String(row.name || 'Unknown User'),
      avatar: row.avatar as string | undefined,
      totalCredits: Number(row.total_credits),
      awardsGiven: Number(row.awards_given),
      awardsReceived: 0,  // Not queried for givers leaderboard
      rank: Number(row.rank),
    })),
  };
}

export default async function LeaderboardPage() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/sign-in');
  }

  const t = await getTranslations('rewards.leaderboard');
  
  const [monthlyData, weeklyData, allTimeData] = await Promise.all([
    getLeaderboardData(orgId, 'monthly'),
    getLeaderboardData(orgId, 'weekly'),
    getLeaderboardData(orgId, 'all-time'),
  ]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>

      <Tabs defaultValue="monthly" className="w-full">
        <TabsList>
          <TabsTrigger value="weekly">{t('periods.weekly')}</TabsTrigger>
          <TabsTrigger value="monthly">{t('periods.monthly')}</TabsTrigger>
          <TabsTrigger value="all-time">{t('periods.allTime')}</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="mt-6">
          <Leaderboard
            orgId={orgId}
            period="weekly"
            topReceivers={weeklyData.topReceivers}
            topGivers={weeklyData.topGivers}
            currentUserId={userId}
          />
        </TabsContent>

        <TabsContent value="monthly" className="mt-6">
          <Leaderboard
            orgId={orgId}
            period="monthly"
            topReceivers={monthlyData.topReceivers}
            topGivers={monthlyData.topGivers}
            currentUserId={userId}
          />
        </TabsContent>

        <TabsContent value="all-time" className="mt-6">
          <Leaderboard
            orgId={orgId}
            period="all-time"
            topReceivers={allTimeData.topReceivers}
            topGivers={allTimeData.topGivers}
            currentUserId={userId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
