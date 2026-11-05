import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// DEF-0B9-ML-CHURN-SCORES-COME-FROM-A-RANDOMLY-INITIALISED-NETWORK-FITTED-ON-GENERATED-EXAMPLES-PRESENTED-AS-ML: the route scored members
// with a randomly initialised network pre-trained on generated examples and stored the score as a prediction. No trained churn model
// exists, so GET and POST answer 501, keep their officer floor and neither score, read nor store anything.
describe('ml/predictions/churn-risk route', () => {
  const source = readFileSync(resolve(__dirname, '../ml/predictions/churn-risk/route.ts'), 'utf8');

  it('answers 501 for GET and POST behind the officer floor', () => {
    expect(source).toContain('ApiError.notImplemented');
    expect(source).toContain("minRole: 'officer'");
    expect(source).toContain('export const GET = handler');
    expect(source).toContain('export const POST = handler');
  });

  it('does not load the generated-example model or touch stored predictions', () => {
    expect(source).not.toContain('churn-prediction-model');
    expect(source).not.toContain('mlPredictions');
    expect(source).not.toContain('Math.random');
  });
});
