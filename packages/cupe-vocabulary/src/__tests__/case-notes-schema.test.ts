/**
 * Case Notes Schema Tests
 *
 * PR-023: Validates Zod schema for case note creation payloads.
 * Mirror of the AddNoteSchema used in /api/cases/[caseId]/notes/route.ts.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Exact mirror of the Zod schema used by the notes API route.
 * Defined here so we can validate it independently of Next.js.
 */
const AddNoteSchema = z.object({
  text: z.string().min(1, 'Note text is required').max(10000, 'Note must be at most 10,000 characters'),
  isInternal: z.boolean().optional().default(false),
});

describe('AddNoteSchema', () => {
  it('accepts a valid note', () => {
    const result = AddNoteSchema.safeParse({
      text: 'Meeting with management scheduled for next Tuesday.',
      isInternal: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts note with isInternal = true', () => {
    const result = AddNoteSchema.safeParse({
      text: 'Internal review: evidence is strong.',
      isInternal: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isInternal).toBe(true);
    }
  });

  it('defaults isInternal to false when omitted', () => {
    const result = AddNoteSchema.safeParse({
      text: 'A simple note.',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isInternal).toBe(false);
    }
  });

  it('rejects empty text', () => {
    const result = AddNoteSchema.safeParse({
      text: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing text field', () => {
    const result = AddNoteSchema.safeParse({
      isInternal: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects text exceeding 10,000 characters', () => {
    const result = AddNoteSchema.safeParse({
      text: 'x'.repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts text at exactly 10,000 characters', () => {
    const result = AddNoteSchema.safeParse({
      text: 'x'.repeat(10000),
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-string text', () => {
    const result = AddNoteSchema.safeParse({
      text: 12345,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-boolean isInternal', () => {
    const result = AddNoteSchema.safeParse({
      text: 'A note.',
      isInternal: 'yes',
    });
    expect(result.success).toBe(false);
  });
});
