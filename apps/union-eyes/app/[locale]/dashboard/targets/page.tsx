/**
 * Targets page for the Template App dashboard
 * Allows users to set and manage their targets and goals
 */

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TargetsPage() {
  return (
    <main className="p-6 md:p-10">
      <h1 className="text-3xl font-bold mb-8">Targets</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance Targets</CardTitle>
            <CardDescription>
              Set and track your performance goals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>No targets configured yet.</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Target Analytics</CardTitle>
            <CardDescription>
              Monitor your progress towards targets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Analytics will appear here once targets are set.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
} 
