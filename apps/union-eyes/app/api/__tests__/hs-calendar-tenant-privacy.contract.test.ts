import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(__dirname, '..', path, 'route.ts'), 'utf8');

describe('Gate 0 incident and personal calendar disclosure controls', () => {
  it('incident item access matches the sensitive collection representative role', () => {
    const collection = source('health-safety/incidents');
    const item = source('health-safety/incidents/[id]');
    expect(collection).toContain("readRole: 'health_safety_rep'");
    expect(item).toContain("readRole: 'health_safety_rep'");
    expect(item).toContain('orgScoped: true');
    expect(item).not.toMatch(/readRole:\s*['"]member['"]/);
  });

  it('incident trends use authenticated organization in both RLS context and aggregate SQL', () => {
    const trends = source('health-safety/incidents/trends');
    expect(trends).toContain('withRLSContext({ organizationId }');
    expect((trends.match(/WHERE organization_id = \$\{organizationId\}/g) ?? []).length).toBe(2);
    expect(trends).not.toMatch(/searchParams\.get\(['"]organizationId['"]\)/);
  });

  it('personal calendar listing and item access enforce owner, visibility and tenant predicates', () => {
    const collection = source('calendar/events');
    const item = source('calendar/events/[id]');
    expect(collection).toContain('eq(calendarEvents.organizationId, organizationId)');
    expect(collection).toContain('eq(calendars.organizationId, organizationId)');
    expect(collection).toContain('eq(calendars.ownerId, userId)');
    expect(collection).toContain('eq(calendarEvents.organizerId, userId)');
    expect(item).toContain('canSeeCalendarEvent(event, userId)');
    expect(item).toContain('canModifyCalendarEvent(event, userId)');
    expect(item).toContain('withRLSContext({ organizationId, userId }');
  });
});
