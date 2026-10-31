const fs = require('fs')
const f = 'app/api/__tests__/sla-breach-risk-feedback.route.test.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 70)}`); s = s.replace(a, b) }
swap("    orderBy: vi.fn(() => chain),\n  };", "    orderBy: vi.fn(() => chain),\n    for: vi.fn(() => chain),\n  };")
swap("notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }) },", "notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }), conflict: (msg: string) => Object.assign(new Error(msg), { status: 409 }) },")
swap(
  "  it('POST fails and records no pilot event when the audit record cannot be written'",
  `  // DEF-0B9-ML-SLA-FEEDBACK-IS-REPEATABLE-CALLER-STATED-VERSION-UNBOUND-AND-A-LOST-UPDATE-READ-MODIFY-WRITE
  describe('feedback integrity', () => {
    const post = async (body: Record<string, unknown> = { predictionId: 'p1', modelVersion: 'v1', actualBreach: true }) => {
      const { POST } = await loadRoute();
      return POST(new NextRequest('http://localhost/api/ml/predictions/sla-breach-risk/feedback', { method: 'POST' }), { organizationId: 'org_1', userId: 'u1', body });
    };

    it('refuses a second outcome for the same prediction and changes nothing', async () => {
      m.selectQueue.push(
        [{ id: 'p1', predictionDate: '2026-01-01', predictedValue: '0.8' }],
        [{ id: 'model_1', version: 'v1', parameters: { scoredPredictionIds: ['p1'] } }],
      );
      const response = await post();
      expect(response.status).toBe(409);
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(m.audit).not.toHaveBeenCalled();
    });

    it('does not create a model under a version the caller names', async () => {
      m.selectQueue.push([{ id: 'p1', predictionDate: '2026-01-01', predictedValue: '0.8' }], []);
      const response = await post({ predictionId: 'p1', modelVersion: 'invented', actualBreach: true });
      expect(response.status).toBe(404);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('refuses to score a prediction against a version other than the one that made it', async () => {
      m.selectQueue.push(
        [{ id: 'p1', modelVersion: 'v0', predictedValue: '0.8' }],
        [{ id: 'model_1', version: 'v1', parameters: {} }],
      );
      expect((await post()).status).toBe(409);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('records the scored prediction id so the next submission is refused', async () => {
      const sets: Array<Record<string, any>> = [];
      mockDb.update.mockReturnValueOnce({ set: vi.fn((values: Record<string, any>) => { sets.push(values); return { where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'model_1', version: 'v1' }]) })) }; }) });
      m.selectQueue.push(
        [{ id: 'p1', predictionDate: '2026-01-01', predictedValue: '0.8' }],
        [{ id: 'model_1', version: 'v1', parameters: {} }],
      );
      expect((await post()).status).toBe(200);
      expect(sets[0].parameters.scoredPredictionIds).toEqual(['p1']);
    });
  });

  it('POST fails and records no pilot event when the audit record cannot be written'`,
)
fs.writeFileSync(f, s)
console.log('ok')
