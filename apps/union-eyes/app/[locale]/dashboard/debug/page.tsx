/**
 * Debug page to view current user information
 * This helps link Clerk users to database records
 */

export const dynamic = 'force-dynamic';

import { auth, currentUser } from "@clerk/nextjs/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getClaimsAssignedToUser } from "@/db/queries/claims-queries";

export default async function DebugPage() {
  const { userId, orgId } = await auth();
  const user = await currentUser();
  
  // Get assigned claims
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let assignedClaims: any[] = [];
  if (userId) {
    try {
      assignedClaims = await getClaimsAssignedToUser(userId);
    } catch (_error) {
}
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Debug Information</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Clerk Authentication</CardTitle>
          <CardDescription>Current user session information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">User ID</p>
            <code className="block mt-1 p-2 bg-muted rounded text-sm font-mono">
              {userId || "Not authenticated"}
            </code>
          </div>
          
          <div>
            <p className="text-sm font-medium text-muted-foreground">Organization ID</p>
            <code className="block mt-1 p-2 bg-muted rounded text-sm font-mono">
              {orgId || "No organization"}
            </code>
          </div>
          
          {user && (
            <>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <code className="block mt-1 p-2 bg-muted rounded text-sm font-mono">
                  {user.emailAddresses[0]?.emailAddress || "No email"}
                </code>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                <code className="block mt-1 p-2 bg-muted rounded text-sm font-mono">
                  {user.firstName} {user.lastName}
                </code>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigned Claims</CardTitle>
          <CardDescription>Claims currently assigned to this user</CardDescription>
        </CardHeader>
        <CardContent>
          {assignedClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground">No claims assigned to this user</p>
          ) : (
            <div className="space-y-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {assignedClaims.map((claim: any) => (
                <div key={claim.id} className="p-3 border rounded">
                  <p className="font-medium">{claim.claimNumber}</p>
                  <p className="text-sm text-muted-foreground">{claim.title}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Database Integration Steps</CardTitle>
          <CardDescription>How to link your Clerk user to test data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">1. Copy your User ID from above</p>
            <p className="text-sm font-medium">2. Update a seed user with your Clerk ID:</p>
            <code className="block mt-1 p-3 bg-muted rounded text-xs font-mono whitespace-pre">
{`UPDATE users 
SET user_id = 'your_clerk_user_id_here'
WHERE email = 'your.email@example.com';`}
            </code>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">3. Assign a test claim to yourself:</p>
            <code className="block mt-1 p-3 bg-muted rounded text-xs font-mono whitespace-pre">
{`UPDATE claims 
SET assigned_to = 'your_clerk_user_id_here'
WHERE claim_number = 'CLM-2025-004';`}
            </code>
          </div>

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              ðŸ’¡ After updating the database, refresh this page to see your assigned claims
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
