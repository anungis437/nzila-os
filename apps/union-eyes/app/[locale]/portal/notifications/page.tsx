/**
 * Notifications Page (Placeholder)
 * Coming soon - notifications center
 */
"use client";


export const dynamic = 'force-dynamic';
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default function NotificationsPage() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Bell className="h-16 w-16 text-gray-400 mb-4" />
        <CardTitle className="mb-2">Notifications Coming Soon</CardTitle>
        <CardDescription className="text-center max-w-md">
          A comprehensive notifications center will be available in a future update, including claim updates, dues reminders, and union announcements.
        </CardDescription>
      </CardContent>
    </Card>
  );
}
