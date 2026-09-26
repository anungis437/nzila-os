import { describe, expect, it } from 'vitest';
import { assertDisposableName } from '../fresh-build';

describe('fresh-build disposable-DB guard (Step 7)', () => {
  it('accepts a properly prefixed disposable name', () => {
    expect(() => assertDisposableName('ue_schema_contract_1699999999999')).not.toThrow();
    expect(() => assertDisposableName('ue_schema_contract_ff989637')).not.toThrow();
  });

  it('refuses names without the disposable prefix', () => {
    expect(() => assertDisposableName('scratch_db')).toThrow(/disposable prefix/i);
  });

  it('refuses staging / production / unknown production-like names', () => {
    expect(() => assertDisposableName('nzila_os_staging')).toThrow();
    expect(() => assertDisposableName('nzila_union_eyes')).toThrow();
    expect(() => assertDisposableName('ue_schema_contract_staging')).toThrow(/forbidden/i);
    expect(() => assertDisposableName('ue_schema_contract_prod_1')).toThrow(/forbidden/i);
  });
});
