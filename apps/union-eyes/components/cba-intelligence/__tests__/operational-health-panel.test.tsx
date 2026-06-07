/**
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OperationalHealthPanel } from "../operational-health-panel";

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OperationalHealthPanel", () => {
  it("renders critical status and check details when health is degraded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              level: "critical",
              generatedAt: "2026-06-03T00:00:00.000Z",
              throughput: {
                ingestionSuccessRate: 0.72,
                extractionSuccessRate: 0.94,
              },
              quality: {
                reviewBacklog: 1220,
                staleSources: 6,
                expiredSources: 2,
              },
              checks: [
                {
                  name: "review_backlog",
                  level: "critical",
                  detail: "Pending review items: 1220",
                },
              ],
            },
          }),
      }),
    );

    renderWithQueryClient(<OperationalHealthPanel />);

    await waitFor(() => {
      expect(screen.getByText("Critical")).toBeDefined();
      expect(screen.getByText("1220")).toBeDefined();
      expect(screen.getByText("Pending review items: 1220")).toBeDefined();
    });
  });

  it("renders an error state when health loading fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    renderWithQueryClient(<OperationalHealthPanel />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load health snapshot.")).toBeDefined();
    });
  });
});
