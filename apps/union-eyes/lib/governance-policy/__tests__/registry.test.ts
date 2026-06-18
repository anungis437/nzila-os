import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  _resetRegistry,
  bootstrapPlatformContracts,
  getAllContracts,
  getContractsByScope,
  isBootstrapped,
  registerContract,
  registerContracts,
  resolveContract,
} from '../registry';
import type { GovernancePolicyContract } from '../contracts';

function contract(id: string, scope: string): GovernancePolicyContract {
  return {
    id,
    label: id,
    scope: scope as never,
    sensitivity: 'low' as never,
    requirements: [],
    evidenceRequired: false,
    auditRequired: false,
  };
}

describe('lib/governance-policy/registry', () => {
  beforeEach(() => _resetRegistry());
  afterEach(() => _resetRegistry());

  it('starts empty and not bootstrapped after reset', () => {
    expect(getAllContracts()).toEqual([]);
    expect(isBootstrapped()).toBe(false);
  });

  it('registers and resolves a single contract', () => {
    registerContract(contract('c1', 'route'));
    expect(resolveContract('c1')?.id).toBe('c1');
    expect(resolveContract('missing')).toBeUndefined();
  });

  it('replaces a contract with the same id', () => {
    registerContract(contract('c1', 'route'));
    registerContract({ ...contract('c1', 'export'), label: 'updated' });
    expect(resolveContract('c1')?.scope).toBe('export');
    expect(getAllContracts()).toHaveLength(1);
  });

  it('registers multiple and filters by scope', () => {
    registerContracts([contract('a', 'route'), contract('b', 'route'), contract('c', 'export')]);
    expect(getAllContracts()).toHaveLength(3);
    expect(getContractsByScope('route' as never)).toHaveLength(2);
    expect(getContractsByScope('export' as never)).toHaveLength(1);
  });

  it('bootstraps platform contracts idempotently', () => {
    bootstrapPlatformContracts();
    const count = getAllContracts().length;
    expect(count).toBeGreaterThan(0);
    expect(isBootstrapped()).toBe(true);
    bootstrapPlatformContracts();
    expect(getAllContracts()).toHaveLength(count);
  });
});
