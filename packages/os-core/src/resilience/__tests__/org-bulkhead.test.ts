/**
 * Org Bulkhead Isolation — Tests
 */

import { describe, it, expect, afterEach } from 'vitest';
import { OrgBulkheadPool, OrgBulkheadOverloadError } from '../org-bulkhead.js';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('OrgBulkheadPool', () => {
  let pool: OrgBulkheadPool;

  afterEach(() => {
    pool?.dispose();
  });

  it('isolates orgs from each other', async () => {
    pool = new OrgBulkheadPool({
      name: 'test',
      maxConcurrentPerOrg: 2,
      maxQueuePerOrg: 0,
    });

    const results: string[] = [];

    // Org A fills its 2 slots
    const p1 = pool.execute('org-a', async () => { await delay(50); results.push('a1'); return 'a1'; });
    const p2 = pool.execute('org-a', async () => { await delay(50); results.push('a2'); return 'a2'; });

    // Org A's 3rd request should be rejected (queue=0)
    await expect(
      pool.execute('org-a', async () => 'a3'),
    ).rejects.toThrow(/full/);

    // Org B should still be able to execute (isolated)
    const p3 = pool.execute('org-b', async () => { results.push('b1'); return 'b1'; });

    await Promise.all([p1, p2, p3]);
    expect(results).toContain('b1');
  });

  it('enforces global concurrency limit', async () => {
    pool = new OrgBulkheadPool({
      name: 'test',
      maxConcurrentPerOrg: 5,
      globalMaxConcurrent: 3,
    });

    const promises = [
      pool.execute('t1', () => delay(100)),
      pool.execute('t2', () => delay(100)),
      pool.execute('t3', () => delay(100)),
    ];

    await expect(
      pool.execute('t4', () => delay(10)),
    ).rejects.toThrow(OrgBulkheadOverloadError);

    await Promise.all(promises);
  });

  it('returns org stats', async () => {
    pool = new OrgBulkheadPool({
      name: 'test',
      maxConcurrentPerOrg: 1,
      maxQueuePerOrg: 5,
    });

    const p1 = pool.execute('org_1', () => delay(100));

    // Allow microtask to start execution
    await delay(5);

    const stats = pool.getOrgStats('org_1');
    expect(stats).not.toBeNull();
    expect(stats!.active).toBe(1);

    expect(pool.getOrgStats('nonexistent')).toBeNull();

    await p1;
  });

  it('returns pool stats', async () => {
    pool = new OrgBulkheadPool({
      name: 'test',
      maxConcurrentPerOrg: 5,
    });

    const p1 = pool.execute('org_a', () => delay(50));
    const p2 = pool.execute('org_b', () => delay(50));

    await delay(5);

    const stats = pool.getPoolStats();
    expect(stats.orgCount).toBe(2);
    expect(stats.globalActive).toBe(2);

    await Promise.all([p1, p2]);
  });

  it('calls onThrottle when org is rejected', async () => {
    const throttled: string[] = [];
    pool = new OrgBulkheadPool({
      name: 'test',
      maxConcurrentPerOrg: 1,
      maxQueuePerOrg: 0,
      onThrottle: (orgId) => throttled.push(orgId),
    });

    const p1 = pool.execute('org_x', () => delay(100));
    await delay(5);

    await expect(pool.execute('org_x', () => delay(10))).rejects.toThrow();
    expect(throttled).toContain('org_x');

    await p1;
  });
});
