import { describe, expect, it } from 'vitest';
import { ApiFailure, ApiShapeError, GENERIC_FAILURE, apiErrorMessage, envelopeData, envelopePages, envelopeRow, envelopeRows, failureDetail, failureLanguage, failureText, readApiError, readApiFailure, readUserFailure, userFailureText } from '../api-envelope';

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

  it('reads the AI feature guard\'s refusal: its reason, and then what to do about it', () => {
    expect(apiErrorMessage({ available: false, reason: 'The feature is off.', fallbackAdvice: 'Ask your administrator.' }, 'fallback')).toBe('The feature is off. Ask your administrator.');
    expect(apiErrorMessage({ available: false, reason: 'The feature is off.' }, 'fallback')).toBe('The feature is off.');
    expect(apiErrorMessage({ available: false, reason: 4, fallbackAdvice: 'Ask your administrator.' }, 'fallback')).toBe('fallback');
  });

  it('never hands a non-string to a screen as its message, and falls back for anything that names none', () => {
    for (const body of [null, undefined, 'text', 4, [], {}, { error: {} }, { error: { message: 4 } }, { error: 4 }, { message: 4 }, { error: '' }, { message: '' }, { reason: '' }]) {
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

  describe('what a person reads for a failure, in their language', () => {
    it('picks French for every French locale and English otherwise', () => {
      expect([failureLanguage('fr'), failureLanguage('fr-CA'), failureLanguage('FR-ca')]).toEqual(['fr', 'fr', 'fr']);
      expect([failureLanguage('en-CA'), failureLanguage('it'), failureLanguage(undefined), failureLanguage(null)]).toEqual(['en', 'en', 'en', 'en']);
    });

    it('reads the status, code and stated message of a refusal', async () => {
      const failure = await readApiFailure(reply(409, { code: 'CONFLICT', message: 'Version changed' }));
      expect(failure).toBeInstanceOf(ApiFailure);
      expect([failure.status, failure.code, failure.message]).toEqual([409, 'CONFLICT', 'Version changed']);
      const bare = await readApiFailure(reply(502, '<html>bad gateway</html>'));
      expect([bare.status, bare.code, bare.message]).toEqual([502, null, '']);
    });

    it('shows the server\'s English reason in English, and never in French', () => {
      const refusal = new ApiFailure(422, 'Member is already assigned to this case');
      expect(userFailureText(refusal, 'Could not save.', 'en')).toBe('Member is already assigned to this case');
      const french = userFailureText(refusal, 'Impossible d’enregistrer.', 'fr');
      expect(french).toBe('Impossible d’enregistrer.');
      expect(french).not.toMatch(/Member|assigned/);
    });

    it('words a refusal from its status when it states nothing, in both languages, and ahead of a French fallback', () => {
      expect(userFailureText(new ApiFailure(403, ''), 'Could not save.', 'en')).toBe('You do not have permission to do this.');
      expect(userFailureText(new ApiFailure(403, 'Insufficient role'), 'Impossible d’enregistrer.', 'fr')).toBe('Vous n’avez pas l’autorisation d’effectuer cette action.');
      expect(userFailureText(new ApiFailure(409, 'Stale'), null, 'fr')).toMatch(/Actualisez/);
      expect(userFailureText(new ApiFailure(500, ''), 'Impossible d’enregistrer.', 'fr')).toBe('Impossible d’enregistrer.');
      expect(userFailureText(new ApiFailure(500, ''), null, 'fr')).toBe(GENERIC_FAILURE.fr);
      expect(userFailureText(new ApiFailure(500, 'Internal server error'), 'x', 'fr')).toMatch(/momentanément/);
    });

    it('never shows exception text, a status line or the browser\'s wording', () => {
      for (const error of [new TypeError('Failed to fetch'), new ApiShapeError('no data'), new Error('HTTP 500'), new Error('Request failed with status 500'), 'HTTP 502', null, undefined]) {
        expect(userFailureText(error, 'Could not save.', 'en')).toBe('Could not save.');
        expect(userFailureText(error, 'Impossible d’enregistrer.', 'fr')).toBe('Impossible d’enregistrer.');
        expect(userFailureText(error, null, 'fr')).toBe(GENERIC_FAILURE.fr);
      }
    });

    it('offers a detail line only for a refusal that states something a person can use', () => {
      expect(failureDetail(new ApiFailure(403, 'Insufficient role'), 'en')).toBe('Insufficient role');
      expect(failureDetail(new ApiFailure(403, 'Insufficient role'), 'fr')).toBe('Vous n’avez pas l’autorisation d’effectuer cette action.');
      expect(failureDetail(new ApiFailure(500, 'Database unavailable'), 'fr')).toBeNull();
      expect(failureDetail(new ApiFailure(500, ''), 'en')).toBeNull();
      expect(failureDetail(new ApiFailure(503, ''), 'en')).toMatch(/temporarily unavailable/);
      for (const error of [new TypeError('Failed to fetch'), new ApiShapeError('no data'), new Error('HTTP 500'), null]) expect(failureDetail(error, 'en')).toBeNull();
    });

    it('reads a failed response straight to words', async () => {
      expect(await readUserFailure(reply(404, { message: 'Grievance not found' }), 'x', 'fr')).toBe('Cet élément n’est plus disponible.');
      expect(await readUserFailure(reply(404, { message: 'Grievance not found' }), 'x', 'en')).toBe('Grievance not found');
      expect(await readUserFailure(reply(500, 'not json'), null, 'en')).toBe(GENERIC_FAILURE.en);
    });
  });
});
