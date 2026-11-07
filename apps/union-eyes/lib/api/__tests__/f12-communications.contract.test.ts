import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API = join(fileURLToPath(new URL('../../../', import.meta.url)), 'app', 'api');
const read = (route: string) => readFileSync(join(API, ...route.split('/'), 'route.ts'), 'utf8');

describe('F12 communications records', () => {
  // DEF-0B5-COMMS-CAMPAIGN-STATUS-AND-STATS-WRITABLE
  it('a campaign body cannot set status, send times, the send-now instruction, statistics or the audience count', () => {
    const owned = ['status', 'sentAt', 'completedAt', 'scheduledAt', 'sendImmediately', 'stats', 'audienceCount'];
    const create = /writableFields: \[([^\]]*)\]/.exec(read('communications/campaigns'))?.[1] ?? '';
    for (const field of owned) expect(create, field).not.toContain(`'${field}'`);
    const patch = /blockedPatchFields: \[([^\]]*)\]/.exec(read('communications/campaigns/[id]'))?.[1] ?? '';
    for (const field of owned) expect(patch, field).toContain(`'${field}'`);
    expect(read('communications/campaigns')).toContain("readRole: 'steward'");
  });

  // DEF-0B5-COMMS-CAMPAIGN-DETACHED-FROM-CONSENT-AND-DELIVERY: schedule's GET is now a real,
  // read-only audience preview (evaluates the platform's real consent/preference tables) and
  // send-test's POST now really sends to one explicit test address - neither commits to or performs
  // a real campaign send, and both still refuse every other method they do not implement.
  it('schedule exposes a real read-only audience preview and refuses every mutation', () => {
    const schedule = read('communications/campaigns/[id]/schedule');
    expect(schedule).toContain('evaluateCampaignAudience');
    expect(schedule).toContain('export const GET');
    expect(schedule).not.toMatch(/export const GET = notImplemented/);
    expect(schedule).toContain('export const PATCH = notImplemented');
    expect(schedule).toContain('export const DELETE = notImplemented');
    expect(schedule).toContain('ApiError.notImplemented');
  });

  it('send-test exposes a real POST that sends only to one explicit test address and refuses every other method', () => {
    const sendTest = read('communications/campaigns/[id]/send-test');
    expect(sendTest).toContain('sendEmail');
    expect(sendTest).toContain('testEmail');
    expect(sendTest).toContain('export const POST');
    expect(sendTest).not.toMatch(/export const POST = notImplemented/);
    expect(sendTest).toContain('export const GET = notImplemented');
    expect(sendTest).toContain('export const PATCH = notImplemented');
    expect(sendTest).toContain('export const DELETE = notImplemented');
    expect(sendTest).toContain('ApiError.notImplemented');
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
    // A poll is created through the dedicated path (DEF-0B5-POLLS-NO-CREATE-OR-VOTE-PATH): its strict schema names no lifecycle or counter field.
    expect(read('communications/polls')).toContain('body: createPollSchema');
    const pollSchema = readFileSync(join(API, '..', '..', 'lib', 'communications', 'polls.ts'), 'utf8').split('export const createPollSchema')[1].split('.strict()')[0];
    for (const field of ['status', 'publishedAt', 'totalVotes', 'uniqueVoters']) expect(pollSchema, field).not.toContain(`${field}:`);
  });
});
