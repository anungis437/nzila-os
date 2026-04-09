"use client";

/**
 * LegacyRedirect — soft redirect banner for deprecated routes.
 *
 * Shows a brief informational banner with the new location, then
 * performs a client-side redirect after a short delay.  This avoids
 * jarring hard-redirect behaviour while still guiding users forward.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";

interface LegacyRedirectProps {
  /** Human-readable name of the old page (e.g. "Messages") */
  oldName: string;
  /** Human-readable name of the destination (e.g. "Inbox") */
  newName: string;
  /** Path to redirect to (e.g. "/dashboard/inbox?type=message") */
  href: string;
  /** Delay in ms before auto-redirect. Default 2000. */
  delay?: number;
}

export function LegacyRedirect({
  oldName,
  newName,
  href,
  delay = 2000,
}: LegacyRedirectProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(Math.ceil((delay) / 1000));

  useEffect(() => {
    const timer = setTimeout(() => router.replace(href), delay);
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => { clearTimeout(timer); clearInterval(tick); };
  }, [router, href, delay]);

  return (
    <div className="max-w-2xl mx-auto mt-20 space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-gray-900">
            {oldName} has moved to {newName}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Redirecting in {countdown}s…{" "}
            <Link href={href} className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium">
              Go now <ArrowRight size={12} />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
