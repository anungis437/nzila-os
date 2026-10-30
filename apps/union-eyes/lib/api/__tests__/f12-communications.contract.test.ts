import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API = join(process.cwd(), 'app', 'api');
const read = (route: string) => readFileSync(join(API, ...route.split('/'), 'route.ts'), 'utf8');

describe('F12 communications records', () => {
  // DEF-0B5-COMMS-CAMPAIGN-STATUS-AND-STATS-WRITABLE
  it('a campaign body cannot set status, send times, statistics or the audience count', () => {
    const create = /writableFields: \[([^\]]*)\]/.exec(read('communications/campaigns'))?.[1] ?? '';
    for (const field of ['status', 'sentAt', 'completedAt', 'stats', 'audienceCount']) expect(create, field).not.toContain(`'${field}'`);
    const patch = /blockedPatchFields: \[([^\]]*)\]/.exec(read('communications/campaigns/[id]'))?.[1] ?? '';
    for (const field of ['status', 'sentAt', 'completedAt', 'stats', 'audienceCount']) expect(patch, field).toContain(`'${field}'`);
    expect(read('communications/campaigns')).toContain("readRole: 'steward'");
  });

  it.each(['communications/campaigns/[id]/schedule', 'communications/campaigns/[id]/send-test'])('%s answers 501 and schedules or sends nothing', (route) => {
    expect(read(route)).toContain('ApiError.notImplemented');
  });

  // DEF-0B5-SURVEY-LIFECYCLE-WRITABLE-DIRECTLY / DEF-0B5-POLLS-ITEM-ROUTE-IS-COLLECTION
  it('survey and poll item routes read the id from their own path segment and guard the lifecycle', () => {
    const survey = read('communications/surveys/[surveyId]');
    expect(survey).toContain("paramName: 'surveyId'");
    expect(survey).toContain("lifecycleBeforeUpdate('survey')");
    const poll = read('communications/polls/[pollId]');
    expect(poll).toContain("paramName: 'pollId'");
    expect(poll).toContain('itemRoute: true');
    expect(poll).toContain('{ GET, PATCH, DELETE }');
    expect(poll).toContain("lifecycleBeforeUpdate('poll')");
  });

  it('a new survey or poll is created with only author fields', () => {
    const survey = /writableFields: \[([^\]]*)\]/.exec(read('communications/surveys'))?.[1] ?? '';
    for (const field of ['status', 'publishedAt', 'responseCount', 'completionRate']) expect(survey, field).not.toContain(`'${field}'`);
    const poll = /writableFields: \[([^\]]*)\]/.exec(read('communications/polls'))?.[1] ?? '';
    for (const field of ['status', 'publishedAt', 'totalVotes', 'uniqueVoters']) expect(poll, field).not.toContain(`'${field}'`);
  });
});
