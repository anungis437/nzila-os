import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const QA_BASELINE_PATH = path.join(REPO_ROOT, 'tooling/sql/union-eyes-qa-baseline.sql');

describe('UnionEyes QA baseline runtime roles', () => {
  it('creates inert runtime principals before role-scoped policies or grants reference them', () => {
    const baseline = fs.readFileSync(QA_BASELINE_PATH, 'utf8');
    const runtimeRoleIndex = baseline.indexOf('CREATE ROLE union_eyes_runtime NOSUPERUSER NOBYPASSRLS NOLOGIN');
    const systemRoleIndex = baseline.indexOf('CREATE ROLE union_eyes_system NOSUPERUSER NOBYPASSRLS NOLOGIN');
    const firstRuntimeReference = baseline.indexOf('union_eyes_runtime');
    const firstSystemReference = baseline.indexOf('union_eyes_system');

    expect(runtimeRoleIndex).toBeGreaterThanOrEqual(0);
    expect(systemRoleIndex).toBeGreaterThanOrEqual(0);
    expect(firstRuntimeReference).toBe(runtimeRoleIndex + 'CREATE ROLE '.length);
    expect(firstSystemReference).toBe(systemRoleIndex + 'CREATE ROLE '.length);
  });
});
