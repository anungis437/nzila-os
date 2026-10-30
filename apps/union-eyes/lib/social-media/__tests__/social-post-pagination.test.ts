import { describe, expect, it } from 'vitest';
import { parseSocialPostPagination } from '../social-post-pagination';

describe('social post pagination bounds', () => {
  it('uses bounded defaults', () => {
    expect(parseSocialPostPagination(new URLSearchParams())).toEqual({ limit: 20, offset: 0 });
  });
  it('accepts the maximum query window', () => {
    expect(parseSocialPostPagination(new URLSearchParams('limit=100&offset=10000'))).toEqual({ limit: 100, offset: 10000 });
  });
  it.each(['limit=0','limit=101','limit=-1','limit=1.5','limit=NaN','limit=Infinity','limit=999999999999999999999999','offset=-1','offset=10001','offset=1e3','offset=2.1','offset= 1','limit=01'])('rejects %s', query => {
    expect(parseSocialPostPagination(new URLSearchParams(query))).toBeNull();
  });
});
