import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROUTE_PATH = path.resolve(
  process.cwd(),
  'apps/union-eyes/app/api/cases/[caseId]/export/route.ts',
);

const MODULE_PATH = path.resolve(
  process.cwd(),
  'apps/union-eyes/lib/evidence-export.ts',
);

describe('UnionEyes evidence export capability contract', () => {
  it('route supports json, zip, and pdf formats', () => {
    const source = fs.readFileSync(ROUTE_PATH, 'utf8');

    expect(source).toContain("format !== 'json'");
    expect(source).toContain("format !== 'zip'");
    expect(source).toContain("format !== 'pdf'");
    expect(source).toContain('buildEvidenceZip');
    expect(source).toContain('buildEvidencePdf');
  });

  it('route exposes envelope/verification metadata for json export', () => {
    const source = fs.readFileSync(ROUTE_PATH, 'utf8');

    expect(source).toContain('envelope');
    expect(source).toContain('verify');
    expect(source).toContain('manifest: packageEnvelope.manifest');
    expect(source).toContain('verification: packageEnvelope.verification');
  });

  it('evidence-export module provides package and download builders', () => {
    const source = fs.readFileSync(MODULE_PATH, 'utf8');

    expect(source).toContain('export interface EvidencePackage');
    expect(source).toContain('export function buildEvidencePackage');
    expect(source).toContain('export async function buildEvidenceZip');
    expect(source).toContain('export async function buildEvidencePdf');
  });
});
