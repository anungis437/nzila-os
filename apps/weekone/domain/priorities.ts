export type PriorityCategory = "revenue" | "risk" | "delegation" | "stop";

export interface Priority {
  rank: number;
  category: PriorityCategory;
  title: string;
  description: string;
}

export function rankPriorities(inputs: {
  runwayDays: number;
  pipelineValue: number;
  overdueInvoices: number;
  topDeal?: { name: string; value: number };
}): Priority[] {
  const ps: Priority[] = [];

  if (inputs.runwayDays < 90) {
    ps.push({
      rank: 1,
      category: "revenue",
      title: "Extend Runway",
      description: `Your runway is ${inputs.runwayDays} days. Push on invoicing and collections this week.`,
    });
  } else if (inputs.pipelineValue > 0) {
    ps.push({
      rank: 1,
      category: "revenue",
      title: "Move Top Deal",
      description: inputs.topDeal
        ? `Push ${inputs.topDeal.name} (${formatCurrency(inputs.topDeal.value)}) to close.`
        : "Follow up on open deals this week.",
    });
  } else {
    ps.push({
      rank: 1,
      category: "revenue",
      title: "Generate Pipeline",
      description: "No open deals. Book 3 discovery calls this week.",
    });
  }

  if (inputs.overdueInvoices > 0) {
    ps.push({
      rank: 2,
      category: "risk",
      title: "Collect Overdue Invoices",
      description: `${inputs.overdueInvoices} invoice(s) overdue. Send reminders today.`,
    });
  } else {
    ps.push({
      rank: 2,
      category: "risk",
      title: "Review Cash Position",
      description: "Confirm burn rate matches plan.",
    });
  }

  ps.push({
    rank: 3,
    category: "delegation",
    title: "Delegate One Thing",
    description:
      "Identify one task that does not need you and delegate it.",
  });

  ps.push({
    rank: 4,
    category: "stop",
    title: "Stop One Thing",
    description:
      "Identify one recurring meeting or activity with low ROI and cancel it.",
  });

  return ps;
}

function formatCurrency(v: number) {
  return `$${v.toLocaleString()}`;
}
