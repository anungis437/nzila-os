/**
 * Comprehensive tests for @nzila/platform-environment config module.
 *
 * Covers: loadEnvFile, saveArtifactManifest, loadLatestArtifact,
 * loadArtifactByDigest, saveGovernanceSnapshot, loadGovernanceSnapshots,
 * findRepoRoot (internal).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted fs mocks ────────────────────────────────────────────────────────

const fsMocks = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  readFileSync: fsMocks.readFileSync,
  writeFileSync: fsMocks.writeFileSync,
  existsSync: fsMocks.existsSync,
  mkdirSync: fsMocks.mkdirSync,
  readdirSync: fsMocks.readdirSync,
}));

import {
  loadEnvFile,
  saveArtifactManifest,
  loadLatestArtifact,
  loadArtifactByDigest,
  saveGovernanceSnapshot,
  loadGovernanceSnapshots,
} from '../config';
import type { DeploymentArtifact, GovernanceSnapshot, EnvironmentName } from '../types';

// ── Helpers ─────────────────────────────────────────────────────────────────

const BASE_DIR = '/fake/root';

function setupRepoRoot() {
  // Make findRepoRoot return BASE_DIR
  fsMocks.existsSync.mockImplementation((p: string) => {
    if (typeof p === 'string' && p.includes('pnpm-workspace.yaml')) return true;
    return false;
  });
}

function makeArtifact(overrides: Partial<DeploymentArtifact> = {}): DeploymentArtifact {
  return {
    artifact_digest: 'sha256:abc123',
    sbom_hash: 'sha256:def456',
    attestation_ref: 'sigstore://ref',
    commit_sha: 'abc1234567890',
    built_at: '2025-06-01T00:00:00Z',
    source_workflow: 'deploy-staging',
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<GovernanceSnapshot> = {}): GovernanceSnapshot {
  return {
    environment: 'STAGING',
    commit: 'abc1234',
    artifact_digest: 'sha256:abc',
    sbom_hash: 'sha256:def',
    policy_engine_status: 'pass',
    change_record_ref: 'CHG-001',
    timestamp: '2025-06-01T00:00:00Z',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRepoRoot();
  });

  // ── loadEnvFile ─────────────────────────────────────────────────────

  describe('loadEnvFile', () => {
    it('loads key-value pairs from env file', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('local.env')) return true;
        return false;
      });
      fsMocks.readFileSync.mockReturnValue(
        'DB_HOST=localhost\nDB_PORT=5432\nDB_NAME=nzila\n',
      );

      const vars = loadEnvFile('LOCAL', BASE_DIR);

      expect(vars).toEqual({
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'nzila',
      });
    });

    it('ignores comments and blank lines', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('local.env')) return true;
        return false;
      });
      fsMocks.readFileSync.mockReturnValue(
        '# This is a comment\n\nKEY=value\n   \n# Another comment\nFOO=bar\n',
      );

      const vars = loadEnvFile('LOCAL', BASE_DIR);
      expect(vars).toEqual({ KEY: 'value', FOO: 'bar' });
    });

    it('ignores lines without = separator', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('local.env')) return true;
        return false;
      });
      fsMocks.readFileSync.mockReturnValue('NO_EQUALS_HERE\nKEY=val\n');

      const vars = loadEnvFile('LOCAL', BASE_DIR);
      expect(vars).toEqual({ KEY: 'val' });
    });

    it('handles values with = characters', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('local.env')) return true;
        return false;
      });
      fsMocks.readFileSync.mockReturnValue('URL=https://host.com?a=1&b=2\n');

      const vars = loadEnvFile('LOCAL', BASE_DIR);
      expect(vars.URL).toBe('https://host.com?a=1&b=2');
    });

    it('returns empty object when file does not exist', () => {
      // existsSync returns false for the env file
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        return false;
      });

      const vars = loadEnvFile('LOCAL', BASE_DIR);
      expect(vars).toEqual({});
    });

    it('maps environment names to correct file names', () => {
      const envMap: Record<string, string> = {
        LOCAL: 'local.env',
        PREVIEW: 'preview.env',
        STAGING: 'staging.env',
        PRODUCTION: 'prod.env',
      };

      for (const [envName, fileName] of Object.entries(envMap)) {
        fsMocks.existsSync.mockImplementation((p: string) => {
          if (p.includes('pnpm-workspace.yaml')) return true;
          if (p.includes(fileName)) return true;
          return false;
        });
        fsMocks.readFileSync.mockReturnValue(`ENV=${envName}\n`);

        const vars = loadEnvFile(envName as EnvironmentName, BASE_DIR);
        expect(vars.ENV).toBe(envName);
      }
    });
  });

  // ── saveArtifactManifest ────────────────────────────────────────────

  describe('saveArtifactManifest', () => {
    it('writes artifact JSON and returns file path', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('artifacts')) return true; // dir exists
        return false;
      });

      const artifact = makeArtifact();
      const path = saveArtifactManifest(artifact, BASE_DIR);

      expect(path).toContain('build-');
      expect(path).toContain(artifact.commit_sha.slice(0, 7));
      expect(path).toContain('.json');
      expect(fsMocks.writeFileSync).toHaveBeenCalledOnce();
      const written = JSON.parse(fsMocks.writeFileSync.mock.calls[0][1]);
      expect(written.commit_sha).toBe(artifact.commit_sha);
    });

    it('creates artifacts directory if it does not exist', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        return false; // dir does not exist
      });

      saveArtifactManifest(makeArtifact(), BASE_DIR);

      expect(fsMocks.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('artifacts'),
        { recursive: true },
      );
    });
  });

  // ── loadLatestArtifact ──────────────────────────────────────────────

  describe('loadLatestArtifact', () => {
    it('returns the latest artifact sorted by filename', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('artifacts')) return true;
        return false;
      });
      fsMocks.readdirSync.mockReturnValue([
        'build-2025-01-01-abc1234.json',
        'build-2025-06-15-def5678.json',
        'build-2025-03-10-ghi9012.json',
      ]);

      const artifact = makeArtifact({ commit_sha: 'def5678def5678' });
      fsMocks.readFileSync.mockReturnValue(JSON.stringify(artifact));

      const result = loadLatestArtifact(BASE_DIR);

      expect(result).not.toBeNull();
      expect(result!.commit_sha).toBe('def5678def5678');
    });

    it('returns null when artifacts directory does not exist', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        return false;
      });

      const result = loadLatestArtifact(BASE_DIR);
      expect(result).toBeNull();
    });

    it('returns null when no build files exist', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('artifacts')) return true;
        return false;
      });
      fsMocks.readdirSync.mockReturnValue(['readme.txt', 'other.json']);

      const result = loadLatestArtifact(BASE_DIR);
      expect(result).toBeNull();
    });

    it('returns null when file contents are invalid', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('artifacts')) return true;
        return false;
      });
      fsMocks.readdirSync.mockReturnValue(['build-2025-01-01-abc1234.json']);
      fsMocks.readFileSync.mockReturnValue('{ not valid json !!!');

      const result = loadLatestArtifact(BASE_DIR);
      expect(result).toBeNull();
    });
  });

  // ── loadArtifactByDigest ────────────────────────────────────────────

  describe('loadArtifactByDigest', () => {
    it('finds an artifact by matching digest', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('artifacts')) return true;
        return false;
      });
      fsMocks.readdirSync.mockReturnValue([
        'build-2025-01-01-aaa.json',
        'build-2025-02-01-bbb.json',
      ]);

      const art1 = makeArtifact({ artifact_digest: 'sha256:aaa' });
      const art2 = makeArtifact({ artifact_digest: 'sha256:bbb' });
      fsMocks.readFileSync
        .mockReturnValueOnce(JSON.stringify(art1))
        .mockReturnValueOnce(JSON.stringify(art2));

      const result = loadArtifactByDigest('sha256:bbb', BASE_DIR);
      expect(result).not.toBeNull();
      expect(result!.artifact_digest).toBe('sha256:bbb');
    });

    it('returns null when no artifact matches digest', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('artifacts')) return true;
        return false;
      });
      fsMocks.readdirSync.mockReturnValue(['build-2025-01-01-aaa.json']);

      const art1 = makeArtifact({ artifact_digest: 'sha256:aaa' });
      fsMocks.readFileSync.mockReturnValue(JSON.stringify(art1));

      const result = loadArtifactByDigest('sha256:zzz', BASE_DIR);
      expect(result).toBeNull();
    });

    it('returns null when artifacts directory does not exist', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        return false;
      });

      const result = loadArtifactByDigest('sha256:abc', BASE_DIR);
      expect(result).toBeNull();
    });

    it('skips files with invalid JSON', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('artifacts')) return true;
        return false;
      });
      fsMocks.readdirSync.mockReturnValue([
        'build-bad.json',
        'build-good.json',
      ]);

      const validArt = makeArtifact({ artifact_digest: 'sha256:target' });
      fsMocks.readFileSync
        .mockReturnValueOnce('broken json{{{')
        .mockReturnValueOnce(JSON.stringify(validArt));

      const result = loadArtifactByDigest('sha256:target', BASE_DIR);
      expect(result!.artifact_digest).toBe('sha256:target');
    });
  });

  // ── saveGovernanceSnapshot ──────────────────────────────────────────

  describe('saveGovernanceSnapshot', () => {
    it('writes snapshot JSON and returns file path', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('governance-snapshots')) return true;
        return false;
      });

      const snapshot = makeSnapshot({ environment: 'STAGING' });
      const path = saveGovernanceSnapshot(snapshot, BASE_DIR);

      expect(path).toContain('governance-snapshot-staging-');
      expect(path).toContain('.json');
      expect(fsMocks.writeFileSync).toHaveBeenCalledOnce();
    });

    it('creates snapshot directory if it does not exist', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        return false;
      });

      saveGovernanceSnapshot(makeSnapshot(), BASE_DIR);

      expect(fsMocks.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('governance-snapshots'),
        { recursive: true },
      );
    });

    it('uses lowercase environment in filename', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('governance-snapshots')) return true;
        return false;
      });

      const path = saveGovernanceSnapshot(makeSnapshot({ environment: 'PRODUCTION' }), BASE_DIR);
      expect(path).toContain('governance-snapshot-production-');
    });
  });

  // ── loadGovernanceSnapshots ─────────────────────────────────────────

  describe('loadGovernanceSnapshots', () => {
    it('loads snapshots matching the environment', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('governance-snapshots')) return true;
        return false;
      });
      fsMocks.readdirSync.mockReturnValue([
        'governance-snapshot-staging-2025-01-01.json',
        'governance-snapshot-staging-2025-06-01.json',
        'governance-snapshot-production-2025-06-01.json',
      ]);

      const snap = makeSnapshot({ environment: 'STAGING' });
      fsMocks.readFileSync.mockReturnValue(JSON.stringify(snap));

      const results = loadGovernanceSnapshots('STAGING', BASE_DIR);

      // 2 staging files match; production file doesn't contain "staging"
      expect(results).toHaveLength(2);
    });

    it('returns empty array when directory does not exist', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        return false;
      });

      const results = loadGovernanceSnapshots('STAGING', BASE_DIR);
      expect(results).toHaveLength(0);
    });

    it('skips files with invalid JSON', () => {
      fsMocks.existsSync.mockImplementation((p: string) => {
        if (p.includes('pnpm-workspace.yaml')) return true;
        if (p.includes('governance-snapshots')) return true;
        return false;
      });
      fsMocks.readdirSync.mockReturnValue([
        'governance-snapshot-staging-2025-01-01.json',
        'governance-snapshot-staging-2025-06-01.json',
      ]);

      const validSnap = makeSnapshot();
      fsMocks.readFileSync
        .mockReturnValueOnce('broken{{{')
        .mockReturnValueOnce(JSON.stringify(validSnap));

      const results = loadGovernanceSnapshots('STAGING', BASE_DIR);
      expect(results).toHaveLength(1);
    });
  });

  // ── findRepoRoot fallback ─────────────────────────────────────────

  describe('findRepoRoot fallback', () => {
    it('returns resolve(.) when pnpm-workspace.yaml is never found', () => {
      fsMocks.existsSync.mockReturnValue(false);

      // loadEnvFile will call findRepoRoot. If root isn't found,
      // it uses resolve('.') as root. Then the env file won't exist → {}
      const vars = loadEnvFile('LOCAL', '/nonexistent/path');
      expect(vars).toEqual({});
    });
  });
});
