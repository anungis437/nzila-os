/**
 * Cookie Consent Banner Component
 * 
 * GDPR-compliant cookie consent banner with granular controls
 * Displays on first visit and allows users to manage preferences
 */

"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useState, useEffect, useId } from "react";
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

import { CONSENT_DECISION_EVENT, readStoredConsentPreferences } from '@/lib/privacy/consent-decision';
import { defaultLocale, locales } from '@/lib/locales';

/** The locale the page is served under: the first segment of its path when it names one the application serves. The banner sits above the locale layouts. */
function useServedLocale(): string {
  const first = usePathname()?.split('/')[1] ?? '';
  return (locales as readonly string[]).includes(first) ? first : defaultLocale;
}

interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

// Set while the last decision's record has not reached the server.
const UNRECORDED_KEY = "cookie_consent_unrecorded";

interface CookieConsentBannerProps {
  organizationId: string;
  messages?: Record<string, string>;
}

export function CookieConsentBanner({ organizationId, messages }: CookieConsentBannerProps) {
  const fieldId = useId();
  const locale = useServedLocale();
  const text = (key: string, fallback: string) => messages?.[key] ?? fallback;
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always true
    functional: false,
    analytics: false,
    marketing: false,
  });

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
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "granted",
      });
    }
  };

  const disableAnalytics = () => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
      });
    }
  };

  const enableMarketing = () => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("consent", "update", {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      });
    }
  };

  const disableMarketing = () => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("consent", "update", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    }
  };

  // The decision is kept on the device and applied at once; the server's copy is the record of it.
  const recordConsent = async (consentId: string, prefs: CookiePreferences): Promise<boolean> => {
    try {
      const response = await fetch("/api/gdpr/cookie-consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": consentId,
        },
        // Who the visitor is and where they connect from are read by the server (the session and the request headers), never taken from the page.
        body: JSON.stringify({
          consentId,
          organizationId,
          ...prefs,
          userAgent: navigator.userAgent,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    // Check if user has already consented
    const consentId = localStorage.getItem("cookie_consent_id");
    const saved = readStoredConsentPreferences();

    if (!consentId || !saved) {
      // Privacy precedes onboarding; no competing presentation timers.
      // A stored decision that cannot be read is not a decision: the banner asks again.
      setShowBanner(true);
    } else {
      // Load existing preferences
      setPreferences(saved);
      applyConsent(saved);
      // A decision whose record never reached the server is sent again (the request carries an idempotency key, so a repeat is harmless).
      if (localStorage.getItem(UNRECORDED_KEY)) {
        recordConsent(consentId, saved).then((recorded) => {
          if (recorded) localStorage.removeItem(UNRECORDED_KEY);
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // Save to backend; a record that did not reach it is remembered and sent again at the next page load
    if (await recordConsent(consentId, prefs)) localStorage.removeItem(UNRECORDED_KEY);
    else localStorage.setItem(UNRECORDED_KEY, consentId);

    applyConsent(prefs);
    window.dispatchEvent(new Event(CONSENT_DECISION_EVENT));
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
        <Dialog open onOpenChange={() => {}}><DialogContent showCloseButton={false} aria-describedby="ue-privacy-description" className="max-w-3xl" onEscapeKeyDown={event => event.preventDefault()} onPointerDownOutside={event => event.preventDefault()}>
          <div className="min-w-0">
            <div className="flex flex-col items-stretch gap-6">
              <div className="flex items-start gap-3 flex-1">
                <Cookie className="w-6 h-6 text-primary mt-1 shrink-0" />
                <div>
                  <DialogTitle className="font-semibold text-lg mb-1">{text("text0", "We value your privacy")}</DialogTitle>
                  <DialogDescription id="ue-privacy-description" className="text-sm text-muted-foreground">{text("text1", "We use cookies to enhance your experience, analyze site traffic, and personalize content. You can customize your preferences or accept all cookies.")}</DialogDescription>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(true)}
                  className="w-full sm:w-auto"
                >
                  <Settings className="w-4 h-4 mr-2" />{text("text2", "Customize")}</Button>
                <Button
                  variant="outline"
                  onClick={handleRejectAll}
                  className="w-full sm:w-auto"
                >{text("text3", "Reject All")}</Button>
                <Button onClick={handleAcceptAll} className="w-full sm:w-auto">{text("text4", "Accept All")}</Button>
              </div>
            </div>
          </div>
        </DialogContent></Dialog>
      )}

      {/* Detailed Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent closeLabel={text('close', 'Close')} className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <Shield className="w-5 h-5" />{text("text5", "Cookie Preferences")}</DialogTitle>
            <DialogDescription>{text("text6", "Manage your cookie preferences. Essential cookies cannot be disabled as they are required for the website to function.")}</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">{text("text7", "Overview")}</TabsTrigger>
              <TabsTrigger value="details">{text("text8", "Details")}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Essential Cookies */}
              <div className="flex items-start justify-between space-x-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex-1">
                  <Label htmlFor={`${fieldId}-essential`} className="font-semibold">{text("text9", "Essential Cookies")}</Label>
                  <p className="text-sm text-muted-foreground mt-1">{text("text13", "Required for the website to function properly. These cannot be disabled.")}</p>
                </div>
                <Switch id={`${fieldId}-essential`} checked={true} disabled className="mt-1" />
              </div>

              {/* Functional Cookies */}
              <div className="flex items-start justify-between space-x-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <Label htmlFor={`${fieldId}-functional`} className="font-semibold">{text("text10", "Functional Cookies")}</Label>
                  <p className="text-sm text-muted-foreground mt-1">{text("text14", "Enable enhanced features like language preferences and personalization.")}</p>
                </div>
                <Switch
                  id={`${fieldId}-functional`}
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
                  <Label htmlFor={`${fieldId}-analytics`} className="font-semibold">{text("text11", "Analytics Cookies")}</Label>
                  <p className="text-sm text-muted-foreground mt-1">{text("text15", "Help us understand how visitors interact with our website through anonymized data.")}</p>
                </div>
                <Switch
                  id={`${fieldId}-analytics`}
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
                  <Label htmlFor={`${fieldId}-marketing`} className="font-semibold">{text("text12", "Marketing Cookies")}</Label>
                  <p className="text-sm text-muted-foreground mt-1">{text("text16", "Used to deliver personalized advertisements and measure campaign effectiveness.")}</p>
                </div>
                <Switch
                  id={`${fieldId}-marketing`}
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
                  <h4 className="font-semibold mb-2">{text("text9", "Essential Cookies")}</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>{text("text22", "session_id - Maintains your login session")}</li>
                    <li>{text("text23", "csrf_token - Protects against security attacks")}</li>
                    <li>{text("text24", "auth_token - Authenticates your requests")}</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">{text("text10", "Functional Cookies")}</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>{text("text25", "language_preference - Remembers your language choice")}</li>
                    <li>{text("text26", "theme_preference - Stores your theme selection")}</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">{text("text11", "Analytics Cookies")}</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>{text("text27", "_ga - Google Analytics identifier")}</li>
                    <li>{text("text28", "_gid - Google Analytics session identifier")}</li>
                    <li>{text("text29", "analytics_session - Internal analytics tracking")}</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">{text("text12", "Marketing Cookies")}</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>{text("text30", "marketing_id - Tracks marketing campaigns")}</li>
                    <li>{text("text31", "ad_personalization - Enables personalized ads")}</li>
                  </ul>
                </div>

                <div className="pt-4 border-t">
                  {/* There is a privacy page and no cookie policy page; the cookies are described above. */}
                  <p className="text-xs text-muted-foreground">{text("text17", "For more information, please read our")}{" "}
                    <Link href={`/${locale}/legal/privacy`}
                      className="text-primary underline"
                      target="_blank"
                    >{text("text18", "Privacy Policy")}</Link>
                    .
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleRejectAll}>{text("text3", "Reject All")}</Button>
            <Button onClick={handleSavePreferences}>{text("text21", "Save Preferences")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

