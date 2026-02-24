'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CampaignDetailsPage() {
  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardContent className="pt-6">
          <p>Campaign details page temporarily disabled due to compilation error. Working on fix...</p>
          <Button onClick={() => window.history.back()}>Go Back</Button>
        </CardContent>
      </Card>
    </div>
  );
}
