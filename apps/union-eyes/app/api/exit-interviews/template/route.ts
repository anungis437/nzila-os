// cognition-governance-ci: allow-route-bypass — Template management; not a cognition engine.
import { withApi, z } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  role: z.enum(['member', 'steward', 'chief_steward', 'officer', 'admin']).optional(),
});

const commonQuestions = [
  'What are the three highest-risk mistakes a new representative should avoid?',
  'Which recurring issues should the next team monitor first in the first 90 days?',
  'What bargaining preparation checklist has worked best in your experience?',
  'Which mediation tactics consistently de-escalate conflict quickly?',
];

const roleTemplates: Record<string, string[]> = {
  member: [
    ...commonQuestions,
    'What member-facing communication style builds trust during difficult cases?',
  ],
  steward: [
    ...commonQuestions,
    'What intake signals tell you a grievance needs immediate escalation?',
  ],
  chief_steward: [
    ...commonQuestions,
    'What staffing and delegation model worked best when case volume spiked?',
  ],
  officer: [
    ...commonQuestions,
    'What governance and policy decisions had the biggest impact on case outcomes?',
  ],
  admin: [
    ...commonQuestions,
    'What organizational risks should successors track in quarterly reviews?',
  ],
};

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    query: querySchema,
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Get exit interview template',
      description: 'Returns a role-specific template for strategic knowledge extraction interviews.',
    },
  },
  async ({ query }) => {
    const role = query.role ?? 'steward';
    return {
      data: {
        role,
        durationMinutes: 30,
        questions: roleTemplates[role] ?? roleTemplates.steward,
      },
    };
  },
);
