/**
 * Notification Preferences Component
 * 
 * Member notification settings with:
 * - Channel preferences (email/SMS/push/in-app)
 * - Frequency controls (immediate/digest)
 * - Category-based preferences
 * - Quiet hours configuration
 * - Do Not Disturb mode
 * 
 * @module components/communication/notification-preferences
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Clock,
  Moon,
  Volume2,
  VolumeX,
  CheckCircle,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

const notificationPreferencesSchema = z.object({
  // Global settings
  doNotDisturb: z.boolean(),
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z.string(),
  quietHoursEnd: z.string(),

  // Category preferences
  announcements: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean(),
    inApp: z.boolean(),
    frequency: z.enum(["immediate", "daily", "weekly"]),
  }),
  training: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean(),
    inApp: z.boolean(),
    frequency: z.enum(["immediate", "daily", "weekly"]),
  }),
  voting: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean(),
    inApp: z.boolean(),
    frequency: z.enum(["immediate", "daily", "weekly"]),
  }),
  claims: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean(),
    inApp: z.boolean(),
    frequency: z.enum(["immediate", "daily", "weekly"]),
  }),
  messages: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean(),
    inApp: z.boolean(),
    frequency: z.enum(["immediate", "daily", "weekly"]),
  }),
  documents: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean(),
    inApp: z.boolean(),
    frequency: z.enum(["immediate", "daily", "weekly"]),
  }),
});

type NotificationPreferencesData = z.infer<typeof notificationPreferencesSchema>;

interface NotificationCategory {
  key: keyof Omit<NotificationPreferencesData, "doNotDisturb" | "quietHoursEnabled" | "quietHoursStart" | "quietHoursEnd">;
  label: string;
  description: string;
  icon: React.ReactNode;
  examples: string[];
}

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: "announcements",
    label: "Announcements",
    description: "Union-wide announcements and updates",
    icon: <Volume2 className="h-5 w-5" />,
    examples: ["Organization updates", "Policy changes", "Important notices"],
  },
  {
    key: "training",
    label: "Training & Education",
    description: "Course enrollments and certifications",
    icon: <Bell className="h-5 w-5" />,
    examples: ["Course reminders", "Certification expiry", "New training available"],
  },
  {
    key: "voting",
    label: "Voting & Elections",
    description: "Election notifications and ballot reminders",
    icon: <CheckCircle className="h-5 w-5" />,
    examples: ["Election announcements", "Ballot reminders", "Results published"],
  },
  {
    key: "claims",
    label: "Claims & Grievances",
    description: "Updates on your claims and cases",
    icon: <Mail className="h-5 w-5" />,
    examples: ["Status updates", "Action required", "Resolution notifications"],
  },
  {
    key: "messages",
    label: "Direct Messages",
    description: "Private messages from representatives",
    icon: <MessageSquare className="h-5 w-5" />,
    examples: ["New messages", "Reply notifications", "Mentions"],
  },
  {
    key: "documents",
    label: "Documents",
    description: "Document sharing and approvals",
    icon: <Mail className="h-5 w-5" />,
    examples: ["Documents shared", "Approval requests", "Version updates"],
  },
];

export interface NotificationPreferencesProps {
  currentPreferences?: Partial<NotificationPreferencesData>;
  onSave?: (preferences: NotificationPreferencesData) => Promise<void>;
}

export function NotificationPreferences({
  currentPreferences,
  onSave,
}: NotificationPreferencesProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  const form = useForm<NotificationPreferencesData>({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: currentPreferences || {
      doNotDisturb: false,
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      announcements: {
        email: true,
        sms: false,
        push: true,
        inApp: true,
        frequency: "immediate",
      },
      training: {
        email: true,
        sms: false,
        push: true,
        inApp: true,
        frequency: "immediate",
      },
      voting: {
        email: true,
        sms: true,
        push: true,
        inApp: true,
        frequency: "immediate",
      },
      claims: {
        email: true,
        sms: true,
        push: true,
        inApp: true,
        frequency: "immediate",
      },
      messages: {
        email: false,
        sms: false,
        push: true,
        inApp: true,
        frequency: "immediate",
      },
      documents: {
        email: true,
        sms: false,
        push: false,
        inApp: true,
        frequency: "daily",
      },
    },
  });

  const doNotDisturb = form.watch("doNotDisturb");
  const quietHoursEnabled = form.watch("quietHoursEnabled");

  const handleSave = async (data: NotificationPreferencesData) => {
    setIsSubmitting(true);
    setSavedSuccess(false);
    try {
      await onSave?.(data);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCategoryPreferences = (category: NotificationCategory) => {
    const categoryKey = category.key;

    return (
      <Card key={categoryKey}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {category.icon}
              <div>
                <CardTitle className="text-lg">{category.label}</CardTitle>
                <p className="text-sm text-gray-600 mt-1">{category.description}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Channel Toggles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField
              control={form.control}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              name={`${categoryKey}.email` as any}
              render={({ field }) => (
                <FormItem className="flex items-center justify-between space-x-2 border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <FormLabel className="!mt-0 text-sm">Email</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={doNotDisturb}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              name={`${categoryKey}.sms` as any}
              render={({ field }) => (
                <FormItem className="flex items-center justify-between space-x-2 border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-gray-500" />
                    <FormLabel className="!mt-0 text-sm">SMS</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={doNotDisturb}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              name={`${categoryKey}.push` as any}
              render={({ field }) => (
                <FormItem className="flex items-center justify-between space-x-2 border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-gray-500" />
                    <FormLabel className="!mt-0 text-sm">Push</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={doNotDisturb}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              name={`${categoryKey}.inApp` as any}
              render={({ field }) => (
                <FormItem className="flex items-center justify-between space-x-2 border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-gray-500" />
                    <FormLabel className="!mt-0 text-sm">In-App</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={doNotDisturb}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Frequency */}
          <FormField
            control={form.control}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name={`${categoryKey}.frequency` as any}
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Frequency</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={doNotDisturb}
                  >
                    <FormControl>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate</SelectItem>
                      <SelectItem value="daily">Daily Digest</SelectItem>
                      <SelectItem value="weekly">Weekly Digest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <FormDescription className="text-xs">
                  Examples: {category.examples.join(", ")}
                </FormDescription>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" />
          Notification Preferences
        </h2>
        <p className="text-gray-600 mt-1">
          Manage how and when you receive notifications
        </p>
      </div>

      {savedSuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            Preferences saved successfully!
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
          {/* Global Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Global Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="doNotDisturb"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-x-2 border rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      {field.value ? (
                        <VolumeX className="h-5 w-5 text-red-500" />
                      ) : (
                        <Volume2 className="h-5 w-5 text-gray-500" />
                      )}
                      <div>
                        <FormLabel className="!mt-0 text-base">Do Not Disturb</FormLabel>
                        <FormDescription className="text-sm">
                          Pause all notifications temporarily
                        </FormDescription>
                      </div>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {doNotDisturb && (
                <Alert>
                  <Moon className="h-4 w-4" />
                  <AlertDescription>
                    Do Not Disturb is enabled. You won&apos;t receive any notifications until you turn
                    this off.
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              <FormField
                control={form.control}
                name="quietHoursEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-x-2 border rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-gray-500" />
                      <div>
                        <FormLabel className="!mt-0 text-base">Quiet Hours</FormLabel>
                        <FormDescription className="text-sm">
                          Limit notifications during specific hours
                        </FormDescription>
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={doNotDisturb}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {quietHoursEnabled && (
                <div className="grid grid-cols-2 gap-4 pl-12">
                  <FormField
                    control={form.control}
                    name="quietHoursStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <input
                            type="time"
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quietHoursEnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <input
                            type="time"
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Preferences */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Notification Categories</h3>
              <p className="text-sm text-gray-600">
                Customize notifications for each category
              </p>
            </div>

            {NOTIFICATION_CATEGORIES.map(renderCategoryPreferences)}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

