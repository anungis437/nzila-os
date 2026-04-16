"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, Radar } from "lucide-react";
import { useAuth } from "@nzila/platform-auth/entra/client";
import { useOrganization } from "@/contexts/organization-context";

interface DemoOverlayState {
  isActive: boolean;
  telemetryTag?: string;
  dataset?: {
    members: number;
    employers: number;
    grievances: number;
    timelines: number;
    resolutions: number;
  };
}

function getClientPilotSessionId(): string {
  if (typeof window === "undefined") return "server";
  const existing = window.sessionStorage.getItem("ue-pilot-session-id");
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.sessionStorage.setItem("ue-pilot-session-id", created);
  return created;
}

export function DemoModeOverlay() {
  const { organizationId } = useOrganization();
  const { userId, isLoaded } = useAuth();
  const [state, setState] = useState<DemoOverlayState>({ isActive: false });
  const telemetryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;

    let cancelled = false;
    const loadDemoState = async () => {
      try {
        const response = await fetch("/api/pilot/onboarding", { credentials: "include" });
        if (!response.ok) return;
        const payload = await response.json();
        const nextState = payload?.data?.demo ?? payload?.demo;
        if (!cancelled && nextState) {
          setState({
            isActive: Boolean(nextState.isActive),
            telemetryTag: nextState.telemetryTag,
            dataset: nextState.dataset,
          });
        }
      } catch {
        if (!cancelled) setState({ isActive: false });
      }
    };

    void loadDemoState();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    if (!state.isActive || !organizationId || !userId || !isLoaded) return;

    const telemetryKey = `${organizationId}:${state.telemetryTag ?? "demo_mode_active"}`;
    if (telemetryKeyRef.current === telemetryKey) return;
    telemetryKeyRef.current = telemetryKey;

    void fetch("/api/pilot/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        eventType: "feature_used",
        userId,
        organizationId,
        sessionId: getClientPilotSessionId(),
        metadata: {
          feature: "demo_mode_overlay",
          telemetryTag: state.telemetryTag ?? "demo_mode_active",
          demoMode: true,
        },
      }),
    });
  }, [state.isActive, state.telemetryTag, organizationId, userId, isLoaded]);

  const summary = useMemo(() => {
    if (!state.dataset) return null;
    return `${state.dataset.employers} employers · ${state.dataset.grievances} grievances · ${state.dataset.timelines} timelines`;
  }, [state.dataset]);

  if (!organizationId || !state.isActive) return null;

  return (
    <>
      <div
        className="sticky top-0 z-50 flex items-center justify-between gap-3 border-y border-amber-300 bg-amber-100/95 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.24em] text-amber-950 shadow-sm backdrop-blur"
        data-telemetry-tag={state.telemetryTag ?? "demo_mode_active"}
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          <span>Demo Mode</span>
        </div>
        <div className="hidden text-[10px] tracking-[0.18em] text-amber-900 md:block">
          {summary ?? "Seeded pilot data is active"}
        </div>
        <div className="flex items-center gap-2 text-[10px] tracking-[0.18em] text-amber-900">
          <Radar className="h-3.5 w-3.5" />
          <span>{state.telemetryTag ?? "demo_mode_active"}</span>
        </div>
      </div>
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-24 top-28 rotate-[-28deg] border border-amber-300/60 bg-amber-100/55 px-24 py-3 text-xs font-bold uppercase tracking-[0.6em] text-amber-900/80 shadow-sm">
          Demo Mode
        </div>
      </div>
    </>
  );
}