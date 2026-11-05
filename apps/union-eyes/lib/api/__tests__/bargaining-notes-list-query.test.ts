import { describe, expect, it } from 'vitest';
import { InvalidBargainingNotesListQuery, parseBargainingNotesListQuery } from '../bargaining-notes-list-query';

const parse = (query: string) => parseBargainingNotesListQuery(new URLSearchParams(query));

describe('bargaining notes collection query bounds', () => {
  it('preserves the ordinary member list defaults', () => {
    expect(parse('')).toMatchObject({ page: 1, limit: 20, sortBy: 'sessionDate', sortOrder: 'desc' });
    expect(parse('tags=contract')).toMatchObject({ page: 1, limit: 50, tags: ['contract'] });
  });

  it('accepts bounded pagination, sort, tags and valid leap-day dates', () => {
    expect(parse('page=2&limit=100&sortBy=createdAt&sortOrder=asc&tags=contract%2Cgrievance&dateFrom=2024-02-29&dateTo=2024-03-01'))
      .toMatchObject({ page: 2, limit: 100, sortBy: 'createdAt', sortOrder: 'asc', tags: ['contract', 'grievance'] });
  });

  it.each(['page=0', 'page=-1', 'page=abc', 'page=1.5', 'page=999999999999999999999', 'limit=0', 'limit=101', 'limit=Infinity'])(
    'refuses malformed or unbounded pagination: %s', (query) => {
      expect(() => parse(query)).toThrow(InvalidBargainingNotesListQuery);
    },
  );

  it.each(['sortBy=organizationId', 'sortOrder=up', 'tags=', 'tags=a%2C', 'tags=%2Ca', 'tags=' + 'x'.repeat(513), 'tags=' + Array(21).fill('x').join(',')])(
    'refuses ambiguous sort or oversized tag input', (query) => {
      expect(() => parse(query)).toThrow(InvalidBargainingNotesListQuery);
    },
  );

  it.each(['dateFrom=2026-02-30', 'dateTo=2025-13-01', 'dateFrom=not-a-date', 'dateFrom=2026-01-01T12:00:00', 'dateFrom=2026-11-02&dateTo=2026-11-01'])(
    'refuses invalid or reversed date bounds: %s', (query) => {
      expect(() => parse(query)).toThrow(InvalidBargainingNotesListQuery);
    },
  );

  it('preserves timezone-qualified timestamps and rejects impossible dates', () => {
    expect(parse('dateFrom=2026-01-01T10%3A00%3A00-05%3A00').dateFrom?.toISOString()).toBe('2026-01-01T15:00:00.000Z');
    expect(() => parse('dateFrom=2026-04-31T10%3A00%3A00Z')).toThrow(InvalidBargainingNotesListQuery);
  });
});
