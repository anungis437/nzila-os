/**
 * Testimonial Approval Actions Component
 *
 * Approve a testimonial and feature or unfeature an approved one. The testimonials table holds `approvedAt` and `featured` and nothing
 * else about review: it has no status, reviewer or rejection reason. The component used to send those fields, which the table does not
 * have, so approval, rejection and featuring were each refused or silently dropped. It now sends only the columns that exist, and offers
 * no rejection, because there is nowhere to record one.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Star, Loader2 } from 'lucide-react';
import type { Testimonial } from '@/types/marketing';

interface TestimonialApprovalActionsProps {
  testimonial: Testimonial;
}

export default function TestimonialApprovalActions({ testimonial }: TestimonialApprovalActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approved = Boolean(testimonial.approvedAt);

  const update = async (changes: Record<string, unknown>, failure: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/testimonials/${testimonial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message ?? data.error ?? failure);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : failure);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && (
        <Alert variant="destructive" className="mb-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!approved && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => update({ approvedAt: new Date().toISOString() }, 'Failed to approve')}
          disabled={loading}
          title="Approve"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 text-green-600" />}
        </Button>
      )}

      {approved && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => update({ featured: !testimonial.featured }, 'Failed to update')}
          disabled={loading}
          title={testimonial.featured ? 'Unfeature' : 'Feature'}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Star className={`h-4 w-4 ${testimonial.featured ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
          )}
        </Button>
      )}
    </div>
  );
}
