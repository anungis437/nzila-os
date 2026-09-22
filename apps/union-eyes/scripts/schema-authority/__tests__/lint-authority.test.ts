import { describe, expect, it } from 'vitest';
import { lint } from '../lint-authority';
import { loadDispositions, loadRegistry, loadRequiredContract } from '../lib/contracts';

describe('schema:authority:lint — real artifacts', () => {
  const r = lint({ skipScan: true });

  it('PASS on the checked-in registry + contracts', () => {
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('manifest acceptance metrics are all zero', () => {
    expect(r.metrics.UNKNOWN_REQUIRED_CONTRACT_ENTRIES).toBe(0);
    expect(r.metrics.DUPLICATE_REQUIRED_CONTRACT_ENTRIES).toBe(0);
    expect(r.metrics.REQUIRED_ENTRY_WITHOUT_OWNER).toBe(0);
    expect(r.metrics.REQUIRED_ENTRY_WITHOUT_EVIDENCE).toBe(0);
    expect(r.metrics.UNOWNED_REQUIRED_TABLES).toBe(0);
    expect(r.metrics.DUAL_OWNED_REQUIRED_TABLES).toBe(0);
    expect(r.metrics.DUPLICATE_DISPOSITION_ENTRIES).toBe(0);
  });
});

describe('schema:authority:lint — failure detection', () => {
  it('rejects an UNKNOWN/SHARED owner', () => {
    const registry = loadRegistry();
    (registry.tables[0] as any).owner = 'SHARED';
    const r = lint({ registry, contract: loadRequiredContract(), dispositions: loadDispositions(), skipScan: true });
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/invalid owner/i);
  });

  it('rejects a required contract entry referencing an unregistered table', () => {
    const contract = loadRequiredContract();
    contract.entries = [
      ...contract.entries,
      { schema: 'public', table: 'not_a_real_table', column: 'x', owner: 'DJANGO_CANONICAL', requirement: 'REQUIRED_NOW', usage: 'DIRECTLY_CONSUMED', access: 'READ', source_paths: ['x'] },
    ];
    const r = lint({ registry: loadRegistry(), contract, dispositions: loadDispositions(), skipScan: true });
    expect(r.ok).toBe(false);
    expect(r.metrics.UNKNOWN_REQUIRED_CONTRACT_ENTRIES).toBe(1);
  });

  it('rejects a duplicate disposition entry', () => {
    const dispositions = loadDispositions();
    const dup = dispositions.dispositions[0];
    dispositions.dispositions = [...dispositions.dispositions, { ...dup }];
    const r = lint({ registry: loadRegistry(), contract: loadRequiredContract(), dispositions, skipScan: true });
    expect(r.ok).toBe(false);
    expect(r.metrics.DUPLICATE_DISPOSITION_ENTRIES).toBe(1);
  });

  it('rejects a required entry without source evidence', () => {
    const contract = loadRequiredContract();
    contract.entries = [
      { schema: 'public', table: contract.entries[0].table, column: 'evidenceless', owner: contract.entries[0].owner, requirement: 'REQUIRED_NOW', usage: 'DIRECTLY_CONSUMED', access: 'READ' },
    ];
    const r = lint({ registry: loadRegistry(), contract, dispositions: loadDispositions(), skipScan: true });
    expect(r.metrics.REQUIRED_ENTRY_WITHOUT_EVIDENCE).toBe(1);
    expect(r.ok).toBe(false);
  });
});
