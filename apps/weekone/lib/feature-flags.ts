export type Plan = "solo" | "team" | "growth";

export const PLAN_FEATURES: Record<Plan, string[]> = {
  solo: ["dashboard", "money", "growth", "focus", "risks", "weekly"],
  team: [
    "dashboard",
    "money",
    "growth",
    "focus",
    "risks",
    "weekly",
    "team-view",
    "invite-cofounder",
  ],
  growth: [
    "dashboard",
    "money",
    "growth",
    "focus",
    "risks",
    "weekly",
    "team-view",
    "invite-cofounder",
    "api-access",
    "custom-integrations",
  ],
};

export function hasFeature(plan: Plan, feature: string): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}
