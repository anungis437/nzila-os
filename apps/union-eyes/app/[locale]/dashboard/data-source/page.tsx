/**
 * Data Source page for the Template App dashboard
 * Allows users to configure and manage their data sources
 */

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DataSourcePage() {
  return (
    <main className="p-6 md:p-10">
      <h1 className="text-3xl font-bold mb-8">Data Source</h1>
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Data Connections</CardTitle>
            <CardDescription>
              Manage your data sources and connections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>No data sources configured.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
} 
