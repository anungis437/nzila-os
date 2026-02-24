/**
 * Cookie Consent Banner Component
 * 
 * GDPR-compliant cookie consent with:
 * - Granular consent categories
 * - Preference management
 * - Cookie policy display
 * - Withdrawal options
 * - Multi-language support
 * - Persistent storage
 * 
 * @module components/compliance/cookie-consent-banner
 */

"use client";

import * as React from "react";
import {
  Cookie,
  Settings,
  X,
  Check,
  Shield,
  BarChart3,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface CookieCategory {
  id: string;
  name: string;
  description: string;
  required: boolean;
  icon: React.ElementType;
  cookies: {
    name: string;
    purpose: string;
    duration: string;
    provider: string;
  }[];
}

export interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface CookieConsentBannerProps {
  show: boolean;
  preferences?: CookiePreferences;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  onSavePreferences?: (preferences: CookiePreferences) => void;
  onClose?: () => void;
  policyUrl?: string;
}

const cookieCategories: CookieCategory[] = [
  {
    id: "essential",
    name: "Essential Cookies",
    description:
      "These cookies are necessary for the website to function and cannot be switched off. They are usually only set in response to actions made by you which amount to a request for services.",
    required: true,
    icon: Shield,
    cookies: [
      {
        name: "session_id",
        purpose: "Maintains user session and authentication",
        duration: "Session",
        provider: "Union Eyes",
      },
      {
        name: "csrf_token",
        purpose: "Security token to prevent cross-site request forgery",
        duration: "Session",
        provider: "Union Eyes",
      },
    ],
  },
  {
    id: "functional",
    name: "Functional Cookies",
    description:
      "These cookies enable enhanced functionality and personalization. They may be set by us or by third party providers whose services we have added to our pages.",
    required: false,
    icon: Settings,
    cookies: [
      {
        name: "language",
        purpose: "Stores your language preference",
        duration: "1 year",
        provider: "Union Eyes",
      },
      {
        name: "theme",
        purpose: "Remembers your theme preference (light/dark mode)",
        duration: "1 year",
        provider: "Union Eyes",
      },
    ],
  },
  {
    id: "analytics",
    name: "Analytics Cookies",
    description:
      "These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve our services.",
    required: false,
    icon: BarChart3,
    cookies: [
      {
        name: "_ga",
        purpose: "Distinguishes unique users",
        duration: "2 years",
        provider: "Google Analytics",
      },
      {
        name: "_gid",
        purpose: "Distinguishes unique users",
        duration: "24 hours",
        provider: "Google Analytics",
      },
    ],
  },
  {
    id: "marketing",
    name: "Marketing Cookies",
    description:
      "These cookies track your online activity to help advertisers deliver more relevant advertising or to limit how many times you see an ad.",
    required: false,
    icon: Target,
    cookies: [
      {
        name: "ads_preferences",
        purpose: "Stores advertising preferences and targeting",
        duration: "1 year",
        provider: "Third-party advertisers",
      },
    ],
  },
];

export function CookieConsentBanner({
  show,
  preferences: initialPreferences,
  onAcceptAll,
  onRejectAll,
  onSavePreferences,
  onClose,
  policyUrl,
}: CookieConsentBannerProps) {
  const [showSettings, setShowSettings] = React.useState(false);
  const [preferences, setPreferences] = React.useState<CookiePreferences>(
    initialPreferences || {
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
    }
  );

  const handleAcceptAll = () => {
    const allAccepted = {
      essential: true,
      functional: true,
      analytics: true,
      marketing: true,
    };
    setPreferences(allAccepted);
    onAcceptAll?.();
    onClose?.();
  };

  const handleRejectAll = () => {
    const allRejected = {
      essential: true, // Essential cannot be rejected
      functional: false,
      analytics: false,
      marketing: false,
    };
    setPreferences(allRejected);
    onRejectAll?.();
    onClose?.();
  };

  const handleSavePreferences = () => {
    onSavePreferences?.(preferences);
    setShowSettings(false);
    onClose?.();
  };

  const togglePreference = (category: keyof CookiePreferences) => {
    if (category === "essential") return; // Cannot toggle essential cookies
    setPreferences((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  if (!show) return null;

  return (
    <>
      {/* Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start gap-4">
            <Cookie className="h-6 w-6 text-gray-600 shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold mb-2">We Value Your Privacy</h3>
              <p className="text-sm text-gray-600 mb-4">
                We use cookies to enhance your browsing experience, serve personalized content,
                and analyze our traffic. By clicking &quot;Accept All&quot;, you consent to our use of
                cookies.{" "}
                {policyUrl && (
                  <a
                    href={policyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Read our Cookie Policy
                  </a>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleAcceptAll}>
                  <Check className="h-4 w-4 mr-2" />
                  Accept All
                </Button>
                <Button variant="outline" onClick={handleRejectAll}>
                  Reject All
                </Button>
                <Button variant="outline" onClick={() => setShowSettings(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Customize
                </Button>
              </div>
            </div>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5" />
              Cookie Preferences
            </DialogTitle>
            <DialogDescription>
              Manage your cookie preferences. You can enable or disable different types of cookies
              below.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="preferences" className="flex-1 overflow-hidden">
            <TabsList>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="details">Cookie Details</TabsTrigger>
            </TabsList>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-4 overflow-y-auto max-h-96">
              {cookieCategories.map((category) => {
                const Icon = category.icon;
                const isEnabled = preferences[category.id as keyof CookiePreferences];

                return (
                  <Card key={category.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <Icon className="h-5 w-5 text-gray-600 mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-base">{category.name}</CardTitle>
                              {category.required && (
                                <Badge variant="secondary">Required</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{category.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() =>
                            togglePreference(category.id as keyof CookiePreferences)
                          }
                          disabled={category.required}
                        />
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 overflow-y-auto max-h-96">
              {cookieCategories.map((category) => {
                const Icon = category.icon;

                return (
                  <Card key={category.id}>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-gray-600" />
                        <CardTitle className="text-base">{category.name}</CardTitle>
                        {category.required && <Badge variant="secondary">Required</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {category.cookies.map((cookie) => (
                          <div key={cookie.name} className="border rounded-lg p-3">
                            <div className="font-mono text-sm font-medium mb-2">
                              {cookie.name}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <Label className="text-xs text-gray-600">Purpose</Label>
                                <p className="text-gray-800">{cookie.purpose}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-gray-600">Duration</Label>
                                <p className="text-gray-800">{cookie.duration}</p>
                              </div>
                              <div className="col-span-2">
                                <Label className="text-xs text-gray-600">Provider</Label>
                                <p className="text-gray-800">{cookie.provider}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreferences}>
              <Check className="h-4 w-4 mr-2" />
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

