/**
 * Cookie Consent Banner Component
 * 
 * GDPR-compliant cookie consent banner with granular controls
 * Displays on first visit and allows users to manage preferences
 */

"use client";
import Link from 'next/link';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cookie, Shield, Settings } from "lucide-react";

interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

interface CookieConsentBannerProps {
  organizationId: string;
  userId?: string;
}

export function CookieConsentBanner({ organizationId, userId }: CookieConsentBannerProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always true
    functional: false,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    // Check if user has already consented
    const consentId = localStorage.getItem("cookie_consent_id");
    const consentData = localStorage.getItem("cookie_consent");

    if (!consentId || !consentData) {
      // Show banner after a short delay
      setTimeout(() => setShowBanner(true), 1000);
    } else {
      // Load existing preferences
      try {
        const saved = JSON.parse(consentData);
        setPreferences(saved.preferences);
        applyConsent(saved.preferences);
      } catch (_e) {
}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyConsent = (prefs: CookiePreferences) => {
    // Apply cookie preferences
    if (prefs.analytics) {
      enableAnalytics();
    } else {
      disableAnalytics();
    }

    if (prefs.marketing) {
      enableMarketing();
    } else {
      disableMarketing();
    }

    // Functional cookies are passive, no special action needed
  };

  const enableAnalytics = () => {
    // Initialize analytics (e.g., Google Analytics)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== "undefined" && (window as any).gtag) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).gtag("consent", "update", {
        analytics_storage: "granted",
      });
    }
  };

  const disableAnalytics = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== "undefined" && (window as any).gtag) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).gtag("consent", "update", {
        analytics_storage: "denied",
      });
    }
  };

  const enableMarketing = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== "undefined" && (window as any).gtag) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).gtag("consent", "update", {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      });
    }
  };

  const disableMarketing = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== "undefined" && (window as any).gtag) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).gtag("consent", "update", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    }
  };

  const saveConsent = async (prefs: CookiePreferences) => {
    const consentId = localStorage.getItem("cookie_consent_id") || crypto.randomUUID();
    const consentData = {
      consentId,
      preferences: prefs,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      ).toISOString(), // 1 year
    };

    // Save to localStorage
    localStorage.setItem("cookie_consent_id", consentId);
    localStorage.setItem("cookie_consent", JSON.stringify(consentData));

    // Save to backend
    try {
      await fetch("/api/gdpr/cookie-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentId,
          userId,
          organizationId,
          ...prefs,
          ipAddress: undefined, // Server will capture this
          userAgent: navigator.userAgent,
        }),
      });
    } catch (_error) {
}

    applyConsent(prefs);
  };

  const handleAcceptAll = async () => {
    const allAccepted = {
      essential: true,
      functional: true,
      analytics: true,
      marketing: true,
    };
    setPreferences(allAccepted);
    await saveConsent(allAccepted);
    setShowBanner(false);
    setShowSettings(false);
  };

  const handleRejectAll = async () => {
    const onlyEssential = {
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
    };
    setPreferences(onlyEssential);
    await saveConsent(onlyEssential);
    setShowBanner(false);
    setShowSettings(false);
  };

  const handleSavePreferences = async () => {
    await saveConsent(preferences);
    setShowBanner(false);
    setShowSettings(false);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Simple Banner */}
      {!showSettings && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
          <div className="container max-w-7xl mx-auto p-4 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-start gap-3 flex-1">
                <Cookie className="w-6 h-6 text-primary mt-1 shrink-0" />
                <div>
                  <h3 className="font-semibold text-lg mb-1">
                    We value your privacy
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    We use cookies to enhance your experience, analyze site
                    traffic, and personalize content. You can customize your
                    preferences or accept all cookies.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(true)}
                  className="w-full sm:w-auto"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Customize
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRejectAll}
                  className="w-full sm:w-auto"
                >
                  Reject All
                </Button>
                <Button onClick={handleAcceptAll} className="w-full sm:w-auto">
                  Accept All
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Cookie Preferences
            </DialogTitle>
            <DialogDescription>
              Manage your cookie preferences. Essential cookies cannot be
              disabled as they are required for the website to function.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Essential Cookies */}
              <div className="flex items-start justify-between space-x-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex-1">
                  <Label className="font-semibold">Essential Cookies</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Required for the website to function properly. These cannot
                    be disabled.
                  </p>
                </div>
                <Switch checked={true} disabled className="mt-1" />
              </div>

              {/* Functional Cookies */}
              <div className="flex items-start justify-between space-x-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <Label className="font-semibold">Functional Cookies</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enable enhanced features like language preferences and
                    personalization.
                  </p>
                </div>
                <Switch
                  checked={preferences.functional}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, functional: checked })
                  }
                  className="mt-1"
                />
              </div>

              {/* Analytics Cookies */}
              <div className="flex items-start justify-between space-x-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <Label className="font-semibold">Analytics Cookies</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Help us understand how visitors interact with our website
                    through anonymized data.
                  </p>
                </div>
                <Switch
                  checked={preferences.analytics}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, analytics: checked })
                  }
                  className="mt-1"
                />
              </div>

              {/* Marketing Cookies */}
              <div className="flex items-start justify-between space-x-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <Label className="font-semibold">Marketing Cookies</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Used to deliver personalized advertisements and measure
                    campaign effectiveness.
                  </p>
                </div>
                <Switch
                  checked={preferences.marketing}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, marketing: checked })
                  }
                  className="mt-1"
                />
              </div>
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-2">Essential Cookies</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>session_id - Maintains your login session</li>
                    <li>csrf_token - Protects against security attacks</li>
                    <li>auth_token - Authenticates your requests</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Functional Cookies</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>language_preference - Remembers your language choice</li>
                    <li>theme_preference - Stores your theme selection</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Analytics Cookies</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>_ga - Google Analytics identifier</li>
                    <li>_gid - Google Analytics session identifier</li>
                    <li>analytics_session - Internal analytics tracking</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Marketing Cookies</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>marketing_id - Tracks marketing campaigns</li>
                    <li>ad_personalization - Enables personalized ads</li>
                  </ul>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    For more information, please read our{" "}
                    <Link href="/privacy-policy"
                      className="text-primary underline"
                      target="_blank"
                    >
                      Privacy Policy
                    </Link>{" "}
                    and{" "}
                    <Link href="/cookie-policy"
                      className="text-primary underline"
                      target="_blank"
                    >
                      Cookie Policy
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleRejectAll}>
              Reject All
            </Button>
            <Button onClick={handleSavePreferences}>
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Hook to access cookie consent preferences
 */
export function useCookieConsent() {
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    functional: false,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const consentData = localStorage.getItem("cookie_consent");
    if (consentData) {
      try {
        const { preferences: saved } = JSON.parse(consentData);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPreferences(saved);
      } catch (_e) {
}
    }
  }, []);

  const updatePreferences = (newPrefs: Partial<CookiePreferences>) => {
    const updated = { ...preferences, ...newPrefs };
    setPreferences(updated);
    
    const consentData = localStorage.getItem("cookie_consent");
    if (consentData) {
      try {
        const data = JSON.parse(consentData);
        data.preferences = updated;
        localStorage.setItem("cookie_consent", JSON.stringify(data));
      } catch (_e) {
}
    }
  };

  return { preferences, updatePreferences };
}

