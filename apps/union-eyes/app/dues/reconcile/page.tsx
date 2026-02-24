/**
 * Reconciliation Page
 * 
 * Match employer remittances to member dues records
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, XCircle, AlertTriangle, Search, RefreshCw 
} from 'lucide-react';
import { api } from '@/lib/api/index';
import { logger } from '@/lib/logger';

interface ReconciliationItem {
  id: string;
  remittanceId: string;
  employerMemberId: string;
  employerName: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  suggestedMatches: SuggestedMatch[];
  status: 'pending' | 'matched' | 'rejected';
}

interface SuggestedMatch {
  memberId: string;
  memberName: string;
  confidence: number;
  reason: string;
}

export default function ReconciliationPage() {
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [_selectedItem, _setSelectedItem] = useState<ReconciliationItem | null>(null);

  useEffect(() => {
    fetchReconciliationQueue();
  }, []);

  const fetchReconciliationQueue = async () => {
    try {
      const data = await api.dues.reconciliation.queue() as unknown as { items: ReconciliationItem[] };
      setItems(data.items || []);
    } catch (error) {
      logger.error('Error fetching reconciliation queue:', error);
      alert('Error loading reconciliation queue.');
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async (itemId: string, memberId: string) => {
    try {
      await api.dues.reconciliation.match(itemId, memberId);
      setItems(items.filter(item => item.id !== itemId));
      alert('Match successful!');
    } catch (error) {
      logger.error('Error matching item:', error);
      alert('Error matching remittance.');
    }
  };

  const handleReject = async (itemId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (api.dues.reconciliation.reject as any)(itemId);
      setItems(items.filter(item => item.id !== itemId));
      alert('Item rejected successfully.');
    } catch (error) {
      logger.error('Error rejecting item:', error);
      alert('Error rejecting item.');
    }
  };

  const runAutoReconciliation = async () => {
    try {
      setLoading(true);
      const result = await api.dues.reconciliation.autoMatch() as { matched: number };
      alert(`Auto-reconciliation complete! Matched ${result.matched || 0} records.`);
      await fetchReconciliationQueue();
    } catch (error) {
      logger.error('Error running auto-reconciliation:', error);
      alert('Error running auto-reconciliation.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto py-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reconciliation</h1>
          <p className="text-muted-foreground">
            Match employer remittances to member dues records
          </p>
        </div>
        <Button onClick={runAutoReconciliation} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Run Auto-Reconciliation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{items.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Auto-Matched (Today)</p>
              <p className="text-2xl font-bold">87</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm text-muted-foreground">Requires Review</p>
              <p className="text-2xl font-bold">12</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alert */}
      {items.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {items.length} remittance{items.length > 1 ? 's' : ''} require manual review
          </AlertDescription>
        </Alert>
      )}

      {/* Reconciliation Items */}
      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.id} className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">{item.employerName}</h3>
                <p className="text-sm text-muted-foreground">
                  Employer ID: {item.employerMemberId} | Amount: ${item.amount}
                </p>
                <p className="text-sm text-muted-foreground">
                  Period: {new Date(item.periodStart).toLocaleDateString()} - {' '}
                  {new Date(item.periodEnd).toLocaleDateString()}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleReject(item.id)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </div>

            {item.suggestedMatches.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Suggested Matches:</h4>
                <div className="space-y-2">
                  {item.suggestedMatches.map((match) => (
                    <div
                      key={match.memberId}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{match.memberName}</p>
                          <p className="text-sm text-muted-foreground">
                            ID: {match.memberId}
                          </p>
                        </div>
                        <Badge variant={match.confidence > 0.9 ? 'default' : 'secondary'}>
                          {Math.round(match.confidence * 100)}% match
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {match.reason}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleMatch(item.id, match.memberId)}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Match
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {item.suggestedMatches.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2" />
                <p>No suggested matches found</p>
                <Button variant="link" className="mt-2">
                  Search manually
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {items.length === 0 && (
        <Card className="p-12 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
          <h3 className="text-xl font-semibold mb-2">All Caught Up!</h3>
          <p className="text-muted-foreground">
            No remittances pending reconciliation
          </p>
        </Card>
      )}
    </div>
  );
}
