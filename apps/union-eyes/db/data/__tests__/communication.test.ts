import { describe, it, expect } from 'vitest';
import { is, Relations, Table } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as comm from '../communication';

/**
 * `db/data/communication.ts` is a declarative Drizzle schema. The "functions"
 * it contributes are (a) the per-table extra-config builders, (b) the
 * `() => column` foreign-key reference callbacks, and (c) the
 * `({ one, many }) => ({...})` relation config callbacks. We import the module
 * (covers the table builders), resolve every foreign key (covers the reference
 * callbacks) and invoke every relation config (covers the relation callbacks).
 */
describe('db/data/communication schema', () => {
  it('exports the expected tables and relations', () => {
    expect(is(comm.externalCommunicationChannels, Table)).toBe(true);
    expect(is(comm.externalCommunicationMessages, Table)).toBe(true);
    expect(is(comm.externalCommunicationUsers, Table)).toBe(true);
    expect(is(comm.externalCommunicationFiles, Table)).toBe(true);
    expect(is(comm.externalCommunicationChannelsRelations, Relations)).toBe(true);
  });

  it('resolves every table config and foreign-key reference', () => {
    for (const value of Object.values(comm)) {
      if (!is(value, Table)) continue;
      const config = getTableConfig(value);
      expect(config.columns.length).toBeGreaterThan(0);
      for (const fk of config.foreignKeys) {
        const ref = fk.reference();
        expect(ref.columns.length).toBeGreaterThan(0);
        expect(ref.foreignColumns.length).toBeGreaterThan(0);
      }
    }
  });

  it('invokes every relation config callback', () => {
    // Drizzle's Relations.config() calls `.withFieldName(name)` on each relation
    // builder result, so the stubbed one/many helpers must return an object that
    // exposes that method.
    const makeRelation = () => {
      const relation: { withFieldName: () => unknown } = {
        withFieldName: () => relation,
      };
      return relation;
    };
    const one = (_table: unknown, _config?: unknown) => makeRelation();
    const many = (_table: unknown, _config?: unknown) => makeRelation();

    let relationCount = 0;
    for (const value of Object.values(comm)) {
      if (!is(value, Relations)) continue;
      relationCount++;
      const config = (value as Relations).config({ one, many } as never);
      expect(config).toBeTruthy();
      expect(Object.keys(config as object).length).toBeGreaterThan(0);
    }
    expect(relationCount).toBe(4);
  });
});
