/**
 * Settings Page (Placeholder)
 * Coming soon - member preferences and settings
 */
"use client";


export const dynamic = 'force-dynamic';
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Settings className="h-16 w-16 text-gray-400 mb-4" />
        <CardTitle className="mb-2">Settings Coming Soon</CardTitle>
        <CardDescription className="text-center max-w-md">
          Member preferences, notification settings, and privacy controls will be available in a future update.
        </CardDescription>
      </CardContent>
    </Card>
  );
}
