export interface BlogPost {
  slug: string
  title: string
  description: string
  publishedAt: string
  readMinutes: number
  keywords: string[]
  body: string[]
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'weekly-planning-for-founders',
    title: 'Weekly Planning for Founders',
    description: 'A practical weekly planning loop founders can run in under 30 minutes.',
    publishedAt: '2026-04-01',
    readMinutes: 6,
    keywords: ['weekly planning', 'founder planning', 'startup execution'],
    body: [
      'Founders do not lose weeks because they are lazy. They lose weeks because priorities get buried under urgent noise.',
      'Start Monday with three outcomes, not twenty tasks. Tie each outcome to cash, pipeline, or delivery confidence.',
      'Run a Friday closeout: what shipped, what drifted, and what gets deleted next week.',
    ],
  },
  {
    slug: 'how-to-stop-startup-chaos',
    title: 'How to Stop Startup Chaos',
    description: 'Replace reactive operations with a repeatable founder operating rhythm.',
    publishedAt: '2026-04-02',
    readMinutes: 7,
    keywords: ['startup chaos', 'startup systems', 'operations'],
    body: [
      'Chaos is usually a systems problem, not a people problem.',
      'If priorities, scorecards, and accountability live in different tools, your week will fragment.',
      'Use one weekly system of record and force every decision through it.',
    ],
  },
  {
    slug: 'monday-reset-system',
    title: 'Monday Reset System',
    description: 'A reset framework to begin each week with clarity and momentum.',
    publishedAt: '2026-04-03',
    readMinutes: 5,
    keywords: ['monday reset', 'weekly reset', 'founder ritual'],
    body: [
      'Your Monday reset should be short, repeatable, and visible to your team.',
      'Review runway, pipeline, and risks before adding new commitments.',
      'End the reset with one written focus statement for the week.',
    ],
  },
  {
    slug: 'founder-burnout-prevention',
    title: 'Founder Burnout Prevention',
    description: 'Execution systems that protect founder energy while improving output.',
    publishedAt: '2026-04-04',
    readMinutes: 8,
    keywords: ['founder burnout', 'focus system', 'founder health'],
    body: [
      'Burnout often appears as constant context switching and low-trust planning.',
      'Reduce decision fatigue by pre-defining weekly checkpoints and scorecards.',
      'Protect two deep-work blocks every week and treat them as non-negotiable.',
    ],
  },
  {
    slug: 'execution-systems-that-work',
    title: 'Execution Systems That Work',
    description: 'What strong execution systems share across high-performing startups.',
    publishedAt: '2026-04-05',
    readMinutes: 7,
    keywords: ['execution system', 'startup operating system', 'team cadence'],
    body: [
      'Good systems are simple enough to run during stressful weeks.',
      'They include visible ownership, measurable outcomes, and a reset cycle.',
      'Complex systems fail because founders stop using them when pressure rises.',
    ],
  },
  {
    slug: 'weekly-scorecards-for-startups',
    title: 'Weekly Scorecards for Startups',
    description: 'How to build scorecards that drive action, not vanity reporting.',
    publishedAt: '2026-04-06',
    readMinutes: 6,
    keywords: ['weekly scorecard', 'startup metrics', 'founder dashboard'],
    body: [
      'A scorecard should answer one question: where do we intervene this week?',
      'Limit metrics to those tied directly to growth, cash, and delivery risk.',
      'If a metric never changes your actions, remove it.',
    ],
  },
  {
    slug: 'best-planner-for-operators',
    title: 'Best Planner for Operators',
    description: 'What operators should look for in a weekly planning product.',
    publishedAt: '2026-04-07',
    readMinutes: 5,
    keywords: ['planner for operators', 'weekly planner', 'operator workflow'],
    body: [
      'The best planner is not the one with the most features. It is the one your team trusts weekly.',
      'Operators need alignment between priorities, accountability, and risk visibility.',
      'Choose tools that reduce status meetings rather than creating more updates.',
    ],
  },
  {
    slug: 'founder-focus-systems',
    title: 'Founder Focus Systems',
    description: 'Design a focus system that keeps founders in strategic work.',
    publishedAt: '2026-04-08',
    readMinutes: 6,
    keywords: ['founder focus', 'focus framework', 'startup productivity'],
    body: [
      'Focus is an operating decision, not a motivation issue.',
      'Start each week by protecting one growth move and one risk reduction move.',
      'Everything else is constrained by time windows and delegated ownership.',
    ],
  },
  {
    slug: 'team-accountability-cadence',
    title: 'Team Accountability Cadence',
    description: 'Build a weekly accountability loop without adding management overhead.',
    publishedAt: '2026-04-09',
    readMinutes: 7,
    keywords: ['team accountability', 'weekly cadence', 'startup management'],
    body: [
      'Accountability should be visible and lightweight.',
      'Assign clear owners for weekly outcomes and run one structured weekly review.',
      'Keep the cadence fixed so execution quality compounds over time.',
    ],
  },
  {
    slug: 'build-momentum-weekly',
    title: 'Build Momentum Weekly',
    description: 'A founder playbook for compounding momentum every week.',
    publishedAt: '2026-04-10',
    readMinutes: 6,
    keywords: ['momentum', 'weekly execution', 'startup growth'],
    body: [
      'Momentum comes from consistent shipped outcomes, not heroic sprints.',
      'Track weekly wins publicly to reinforce operating confidence across the team.',
      'When momentum drops, simplify your plan before adding complexity.',
    ],
  },
]

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug)
}
