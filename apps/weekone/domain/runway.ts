export interface RunwayInput {
  cashOnHand: number;
  monthlyBurn: number;
}

export function calculateRunway(input: RunwayInput): number {
  if (input.monthlyBurn <= 0) return Infinity;
  return Math.floor((input.cashOnHand / input.monthlyBurn) * 30);
}

export function runwayStatus(days: number): "critical" | "warning" | "healthy" {
  if (days < 60) return "critical";
  if (days < 120) return "warning";
  return "healthy";
}
