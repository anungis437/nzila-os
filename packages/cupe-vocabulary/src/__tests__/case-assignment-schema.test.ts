/**
 * Case Assignment Schema Tests
 *
 * PR-021: Validates Zod schema for case assignment payloads.
 * Mirror of the AssignCaseSchema used in /api/cases/[caseId]/assign/route.ts.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const AssignCaseSchema = z.object({
  assigneeId: z.string().min(1, 'Assignee ID is required'),
  reason: z.string().max(1000).optional(),
});

describe('AssignCaseSchema', () => {
  it('accepts valid assignment with reason', () => {
    const result = AssignCaseSchema.safeParse({
      assigneeId: 'user_abc123',
      reason: 'Best match for this worksite location.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts assignment without reason', () => {
    const result = AssignCaseSchema.safeParse({
      assigneeId: 'user_abc123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty assigneeId', () => {
    const result = AssignCaseSchema.safeParse({
      assigneeId: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing assigneeId', () => {
    const result = AssignCaseSchema.safeParse({
      reason: 'Some reason',
    });
    expect(result.success).toBe(false);
  });

  it('rejects reason exceeding 1000 characters', () => {
    const result = AssignCaseSchema.safeParse({
      assigneeId: 'user_abc123',
      reason: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts reason at exactly 1000 characters', () => {
    const result = AssignCaseSchema.safeParse({
      assigneeId: 'user_abc123',
      reason: 'x'.repeat(1000),
    });
    expect(result.success).toBe(true);
  });
});
