/**
 * workshopThemeClusterer
 * ──────────────────────
 * Deterministic helper that groups workshop-derived continuity concerns by
 * canonical theme identifier. AI may *summarize* the clusters via the
 * facilitator pipeline, but the clustering itself is deterministic and
 * reviewer-editable — never AI-determined.
 */

export interface WorkshopThemeConcern {
  readonly concernId: string;
  /** Canonical theme identifier; never free text. */
  readonly themeId: string;
  /** Optional reviewer-supplied note (treated as reviewer input only). */
  readonly reviewerNote?: string;
}

export interface WorkshopThemeCluster {
  readonly themeId: string;
  readonly concernIds: ReadonlyArray<string>;
  readonly count: number;
}

export interface WorkshopThemeClusteringResult {
  readonly clusters: ReadonlyArray<WorkshopThemeCluster>;
  readonly totalConcerns: number;
}

export function clusterWorkshopThemes(
  concerns: ReadonlyArray<WorkshopThemeConcern>,
): WorkshopThemeClusteringResult {
  const byTheme = new Map<string, string[]>();
  for (const c of concerns) {
    if (!byTheme.has(c.themeId)) byTheme.set(c.themeId, []);
    byTheme.get(c.themeId)!.push(c.concernId);
  }
  const clusters: WorkshopThemeCluster[] = [];
  for (const [themeId, ids] of byTheme.entries()) {
    const sorted = [...new Set(ids)].sort();
    clusters.push({
      themeId,
      concernIds: Object.freeze(sorted),
      count: sorted.length,
    });
  }
  clusters.sort((a, b) =>
    b.count - a.count || a.themeId.localeCompare(b.themeId),
  );
  return {
    clusters: Object.freeze(clusters),
    totalConcerns: concerns.length,
  };
}
