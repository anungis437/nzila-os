import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

vi.mock('@/components/elections/election-records-list', () => ({ ElectionRecordsList: () => null }));
vi.mock('@/components/elections/election-record-form', () => ({ ElectionRecordForm: () => null }));
vi.mock('@/components/elections/election-record-detail', () => ({ ElectionRecordDetail: () => null }));

import { ElectionRecordsList } from '@/components/elections/election-records-list';
import { ElectionRecordForm } from '@/components/elections/election-record-form';
import { ElectionRecordDetail } from '@/components/elections/election-record-detail';
import * as listPage from '../page';
import * as newPage from '../new/page';
import * as detailPage from '../[id]/page';

describe('election pages', () => {
  it('render the council election record screens, not a voting interface', () => {
    expect((listPage.default() as ReactElement).type).toBe(ElectionRecordsList);
    expect((newPage.default() as ReactElement).type).toBe(ElectionRecordForm);
  });

  it('read the record id from the awaited route params (a Promise in this Next.js version)', async () => {
    const element = (await detailPage.default({
      params: Promise.resolve({ locale: 'en-CA', id: 'e1111111-1111-4111-8111-111111111111' }),
    })) as ReactElement<{ electionId: string }>;
    expect(element.type).toBe(ElectionRecordDetail);
    expect(element.props.electionId).toBe('e1111111-1111-4111-8111-111111111111');
    expect(element.key).toBe('e1111111-1111-4111-8111-111111111111');
  });

  it('are rendered per request', () => {
    expect(listPage.dynamic).toBe('force-dynamic');
    expect(newPage.dynamic).toBe('force-dynamic');
    expect(detailPage.dynamic).toBe('force-dynamic');
  });
});
