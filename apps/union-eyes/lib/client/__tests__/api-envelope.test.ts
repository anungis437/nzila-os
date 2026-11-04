import { describe, expect, it } from 'vitest';
import { ApiShapeError, apiErrorMessage, envelopeData, envelopePages, envelopeRow, envelopeRows, failureText, readApiError } from '../api-envelope';

const reply = (status: number, body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('api-envelope', () => {
  it('reads the payload of a withApi answer, the record of an item route and the records of a list route', () => {
    expect(envelopeData({ success: true, data: { saved: true } })).toEqual({ saved: true });
    expect(envelopeRow({ success: true, data: { data: { id: 'a' } } })).toEqual({ id: 'a' });
    expect(envelopeRows({ success: true, data: { data: [{ id: 'a' }], pagination: { page: 1 } } })).toEqual([{ id: 'a' }]);
  });

  it('reads the page count of a list route and refuses a list that does not say how many pages it has', () => {
    expect(envelopePages({ success: true, data: { data: [], pagination: { page: 1, totalPages: 4 } } })).toBe(4);
    for (const pagination of [undefined, null, {}, { totalPages: '4' }, { totalPages: Number.NaN }, [4]]) {
      expect(() => envelopePages({ success: true, data: { data: [], pagination } })).toThrow(ApiShapeError);
    }
    expect(() => envelopePages({ success: true })).toThrow(ApiShapeError);
  });

  it('refuses a body that is not the expected shape instead of defaulting to an empty record or list', () => {
    for (const body of [null, 'x', [], {}, { data: null }, { data: [] }]) expect(() => envelopeData(body)).toThrow(ApiShapeError);
    expect(() => envelopeRow({ data: { id: 'a' } })).toThrow(ApiShapeError);
    expect(() => envelopeRow({ data: { data: [] } })).toThrow(ApiShapeError);
    expect(() => envelopeRows({ data: { data: { id: 'a' } } })).toThrow(ApiShapeError);
    expect(() => envelopeRows({ data: { rows: [] } })).toThrow(ApiShapeError);
  });

  it('reads the message of the standard error body, of a retired route and of a plain error string', async () => {
    expect(await readApiError(reply(403, { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'steward' role" }), 'fallback')).toBe("Requires at least 'steward' role");
    expect(await readApiError(reply(501, { error: { code: 'NOT_IMPLEMENTED', message: 'retired' } }), 'fallback')).toBe('retired');
    expect(await readApiError(reply(400, { error: 'bad input' }), 'fallback')).toBe('bad input');
  });

  it('falls back when the failure carries no readable message', async () => {
    expect(await readApiError(reply(500, '<html>gateway</html>'), 'fallback')).toBe('fallback');
    expect(await readApiError(reply(500, {}), 'fallback')).toBe('fallback');
    expect(await readApiError(reply(500, { message: '' }), 'fallback')).toBe('fallback');
  });

  it('takes the message from a body that was already read, whichever of the three shapes the route answers with', () => {
    expect(apiErrorMessage({ code: 'VALIDATION_ERROR', message: 'Invalid document payload', timestamp: 'now' }, 'fallback')).toBe('Invalid document payload');
    expect(apiErrorMessage({ error: { code: 'NOT_IMPLEMENTED', message: 'retired' } }, 'fallback')).toBe('retired');
    expect(apiErrorMessage({ error: 'bad input' }, 'fallback')).toBe('bad input');
  });

  it('prefers the sentence over the code when a route answers { error: <code>, message: <sentence> }', () => {
    expect(apiErrorMessage({ error: 'VALIDATION_ERROR', message: 'Intake validation failed.' }, 'fallback')).toBe('Intake validation failed.');
    expect(apiErrorMessage({ error: 'MEMBER_IDENTITY_MISMATCH', message: 'Self-service intake must use the authenticated member.' }, 'fallback')).toBe('Self-service intake must use the authenticated member.');
  });

  it('never hands a non-string to a screen as its message, and falls back for anything that names none', () => {
    for (const body of [null, undefined, 'text', 4, [], {}, { error: {} }, { error: { message: 4 } }, { error: 4 }, { message: 4 }, { error: '' }, { message: '' }]) {
      expect(apiErrorMessage(body, 'fallback')).toBe('fallback');
    }
  });

  it('shows what a refusal stated, and the screen\'s own words for a request that never got an answer', () => {
    // an Error made from the message the route gave, and one made by the screen for a body it cannot use
    expect(failureText(new Error('Agreement not found'), 'fallback')).toBe('Agreement not found');
    expect(failureText(new ApiShapeError('no data'), 'fallback')).toBe('Unexpected API response: no data');
    // fetch rejects with a TypeError whose text is the browser's own
    expect(failureText(new TypeError('Failed to fetch'), 'fallback')).toBe('fallback');
    expect(failureText(new Error(''), 'fallback')).toBe('fallback');
    expect(failureText(null, 'fallback')).toBe('fallback');
    expect(failureText('text', 'fallback')).toBe('fallback');
  });
});
