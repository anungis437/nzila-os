import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { BiometricAuth, createBiometricAuth, biometricAuth } from '../biometric-auth';

let store: Map<string, string>;
let credentialsApi: { get: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
let isPlatformAvailable: ReturnType<typeof vi.fn>;

class FakePublicKeyCredential {
  static isUserVerifyingPlatformAuthenticatorAvailable = (...a: unknown[]) => isPlatformAvailable(...a);
}

function fakeCredential(idBytes = [1, 2, 3], publicKey: ArrayBuffer | null = new Uint8Array([4, 5]).buffer) {
  return {
    rawId: new Uint8Array(idBytes).buffer,
    response: { getPublicKey: () => publicKey },
  };
}

function setupSupported(extra: Record<string, unknown> = {}) {
  vi.stubGlobal('window', { PublicKeyCredential: FakePublicKeyCredential, ...extra });
  vi.stubGlobal('PublicKeyCredential', FakePublicKeyCredential);
}

describe('biometric-auth', () => {
  beforeEach(() => {
    store = new Map();
    credentialsApi = {
      get: vi.fn(async () => fakeCredential()),
      create: vi.fn(async () => fakeCredential()),
    };
    isPlatformAvailable = vi.fn(async () => true);
    vi.stubGlobal('navigator', { credentials: credentialsApi });
    vi.stubGlobal('crypto', { getRandomValues: (arr: Uint8Array) => arr });
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
    setupSupported();
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('checkAvailability', () => {
    it('reports server-side environments as unavailable', async () => {
      vi.stubGlobal('window', undefined);
      const a = await new BiometricAuth().checkAvailability();
      expect(a.available).toBe(false);
      expect(a.reason).toBe('Server-side environment');
    });

    it('reports unavailable when WebAuthn is not supported', async () => {
      vi.stubGlobal('window', {});
      const a = await new BiometricAuth().checkAvailability();
      expect(a.reason).toBe('WebAuthn not supported');
    });

    it('detects a platform authenticator (fingerprint, high)', async () => {
      const a = await new BiometricAuth().checkAvailability();
      expect(a).toMatchObject({ available: true, type: 'fingerprint', level: 'high' });
    });

    it('detects Touch ID', async () => {
      setupSupported({ TouchID: {} });
      const a = await new BiometricAuth().checkAvailability();
      expect(a.type).toBe('fingerprint');
    });

    it('detects Face ID', async () => {
      setupSupported({ FaceID: {} });
      const a = await new BiometricAuth().checkAvailability();
      expect(a.type).toBe('face');
    });

    it('reports none when no authenticator is available', async () => {
      isPlatformAvailable.mockResolvedValueOnce(false);
      const a = await new BiometricAuth().checkAvailability();
      expect(a).toMatchObject({ available: false, type: 'none', level: 'none' });
    });

    it('treats a thrown platform check as no authenticator', async () => {
      isPlatformAvailable.mockRejectedValueOnce(new Error('nope'));
      const a = await new BiometricAuth().checkAvailability();
      expect(a.type).toBe('none');
    });

    it('returns the error reason when the check throws', async () => {
      credentialsApi.get.mockRejectedValueOnce(new Error('boom'));
      const a = await new BiometricAuth().checkAvailability();
      expect(a.available).toBe(false);
      expect(a.reason).toBe('boom');
    });
  });

  describe('register', () => {
    it('fails when biometrics are unavailable', async () => {
      isPlatformAvailable.mockResolvedValue(false);
      const r = await new BiometricAuth().register('user-1');
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/not available/);
    });

    it('registers a new credential successfully', async () => {
      const r = await new BiometricAuth().register('user-1');
      expect(r.success).toBe(true);
      expect(r.credentialId).toBeTruthy();
      expect(store.has('biometric_credential_user-1')).toBe(true);
    });

    it('handles a missing public key', async () => {
      credentialsApi.create.mockResolvedValueOnce(fakeCredential([1], null));
      const r = await new BiometricAuth().register('user-1');
      expect(r.success).toBe(true);
    });

    it('fails when credential creation returns null', async () => {
      credentialsApi.create.mockResolvedValueOnce(null);
      const r = await new BiometricAuth().register('user-1');
      expect(r.error).toMatch(/Credential creation failed/);
    });

    it('returns the error message when creation throws', async () => {
      credentialsApi.create.mockRejectedValueOnce(new Error('user cancelled'));
      const r = await new BiometricAuth().register('user-1');
      expect(r.success).toBe(false);
      expect(r.error).toBe('user cancelled');
    });
  });

  describe('authenticate', () => {
    async function seed(auth: BiometricAuth, userId: string) {
      await auth.register(userId);
      credentialsApi.create.mockClear();
    }

    it('fails when biometrics are unavailable', async () => {
      isPlatformAvailable.mockResolvedValue(false);
      const r = await new BiometricAuth().authenticate('user-1');
      expect(r.error).toMatch(/not available/);
    });

    it('fails when no credential is stored', async () => {
      const r = await new BiometricAuth().authenticate('no-cred');
      expect(r.error).toMatch(/No credential found/);
    });

    it('authenticates successfully outside production', async () => {
      const auth = new BiometricAuth();
      await seed(auth, 'user-1');
      const r = await auth.authenticate('user-1');
      expect(r.success).toBe(true);
      expect(r.credentialId).toBeTruthy();
      // counter incremented and persisted
      const persisted = JSON.parse(store.get('biometric_credential_user-1')!);
      expect(persisted.counter).toBe(1);
    });

    it('fails closed in production', async () => {
      process.env.NODE_ENV = 'production';
      const auth = new BiometricAuth();
      await seed(auth, 'user-1');
      const r = await auth.authenticate('user-1');
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/server-side verification/);
    });

    it('fails when assertion returns null', async () => {
      const auth = new BiometricAuth();
      await seed(auth, 'user-1');
      // first get() is consumed by checkAvailability, second by authenticate
      credentialsApi.get.mockResolvedValueOnce(fakeCredential()).mockResolvedValueOnce(null);
      const r = await auth.authenticate('user-1');
      expect(r.error).toMatch(/Authentication failed/);
    });

    it('returns the error message when authentication throws', async () => {
      const auth = new BiometricAuth();
      await seed(auth, 'user-1');
      credentialsApi.get.mockResolvedValueOnce(fakeCredential()).mockRejectedValueOnce(new Error('aborted'));
      const r = await auth.authenticate('user-1');
      expect(r.error).toBe('aborted');
    });
  });

  describe('credential storage', () => {
    it('hasCredential reflects stored state', async () => {
      const auth = new BiometricAuth();
      expect(await auth.hasCredential('user-1')).toBe(false);
      await auth.register('user-1');
      expect(await auth.hasCredential('user-1')).toBe(true);
    });

    it('removeCredential deletes the stored credential', async () => {
      const auth = new BiometricAuth();
      await auth.register('user-1');
      await auth.removeCredential('user-1');
      expect(store.has('biometric_credential_user-1')).toBe(false);
    });

    it('removeCredential is a no-op server-side', async () => {
      vi.stubGlobal('window', undefined);
      await expect(new BiometricAuth().removeCredential('user-1')).resolves.toBeUndefined();
    });

    it('getCredential returns null for corrupt JSON', async () => {
      store.set('biometric_credential_user-1', '{not valid json');
      const auth = new BiometricAuth();
      expect(await auth.hasCredential('user-1')).toBe(false);
    });
  });

  describe('factory and singleton', () => {
    it('createBiometricAuth builds an instance', () => {
      expect(createBiometricAuth({ rpId: 'x' })).toBeInstanceOf(BiometricAuth);
    });
    it('exports a singleton', () => {
      expect(biometricAuth).toBeInstanceOf(BiometricAuth);
    });
  });
});
