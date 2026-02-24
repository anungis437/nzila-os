/**
 * Biometric Authentication Library
 * 
 * Provides WebAuthn/FIDO2 biometric authentication for mobile devices
 * Supports fingerprint, face recognition, and device PIN
 */

import { logger } from '@/lib/logger';

// Biometric types
export type BiometricType = 'fingerprint' | 'face' | 'iris' | 'none';

// Authentication level
export type AuthLevel = 'none' | 'low' | 'medium' | 'high';

/**
 * Biometric configuration
 */
export interface BiometricConfig {
  rpId: string;
  rpName: string;
  timeout: number;
  userVerification: 'required' | 'preferred' | 'discouraged';
}

/**
 * Credential interface
 */
export interface BiometricCredential {
  id: string;
  publicKey: string;
  counter: number;
  createdAt: Date;
}

/**
 * Biometric authentication result
 */
export interface BiometricResult {
  success: boolean;
  error?: string;
  credentialId?: string;
}

/**
 * Biometric availability result
 */
export interface BiometricAvailability {
  available: boolean;
  type: BiometricType;
  level: AuthLevel;
  reason?: string;
}

const DEFAULT_CONFIG: BiometricConfig = {
  rpId: 'unioneyes.app',
  rpName: 'Union Eyes',
  timeout: 60000,
  userVerification: 'preferred',
};

/**
 * Biometric Authentication Manager
 */
export class BiometricAuth {
  private config: BiometricConfig;
  private isAvailable: boolean = false;

  constructor(config: Partial<BiometricConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if biometric authentication is available
   */
  async checkAvailability(): Promise<BiometricAvailability> {
    if (typeof window === 'undefined') {
      return {
        available: false,
        type: 'none',
        level: 'none',
        reason: 'Server-side environment',
      };
    }

    // Check if WebAuthn is supported
    if (!window.PublicKeyCredential) {
      return {
        available: false,
        type: 'none',
        level: 'none',
        reason: 'WebAuthn not supported',
      };
    }

    try {
      // Check for available authenticators
      const _authenticators = await navigator.credentials?.get({ publicKey: { challenge: new Uint8Array(16) } }) as PublicKeyCredential | null;
      
      // Check for biometric support
      const biometricType = await this.detectBiometricType();
      
      this.isAvailable = biometricType !== 'none';

      return {
        available: this.isAvailable,
        type: biometricType,
        level: this.isAvailable ? 'high' : 'none',
      };
    } catch (error) {
      logger.error('Biometric availability check failed', { error });
      return {
        available: false,
        type: 'none',
        level: 'none',
        reason: (error as Error).message,
      };
    }
  }

  /**
   * Detect available biometric type
   */
  private async detectBiometricType(): Promise<BiometricType> {
    // Check for Touch ID (Safari)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).TouchID) {
      return 'fingerprint';
    }

    // Check for Face ID (Safari)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).FaceID) {
      return 'face';
    }

    // Check for WebAuthn authenticator
    try {
      const isSupported = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (isSupported) {
        // Platform authenticator could be fingerprint, face, or PIN
        return 'fingerprint'; // Assume fingerprint as most common
      }
    } catch (_e) {
      // Not supported
    }

    return 'none';
  }

  /**
   * Register a new credential
   */
  async register(userId: string): Promise<BiometricResult> {
    const availability = await this.checkAvailability();
    
    if (!availability.available) {
      return {
        success: false,
        error: 'Biometric authentication not available',
      };
    }

    try {
      // Generate challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Create credential creation options
      const options: PublicKeyCredentialCreationOptions = {
        rp: {
          id: this.config.rpId,
          name: this.config.rpName,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: userId,
          displayName: userId,
        },
        challenge,
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        timeout: this.config.timeout,
      };

      // Create credential
      const credential = await navigator.credentials?.create({
        publicKey: options,
      }) as PublicKeyCredential;

      if (!credential) {
        return {
          success: false,
          error: 'Credential creation failed',
        };
      }

      // Store credential ID (in production, send to server)
      const credentialId = this.arrayBufferToBase64(credential.rawId);
      
      // Get public key
      const publicKey = (credential.response as AuthenticatorAttestationResponse).getPublicKey();
      const publicKeyBase64 = publicKey ? this.arrayBufferToBase64(publicKey) : '';

      // Store locally for demo
      await this.storeCredential(userId, {
        id: credentialId,
        publicKey: publicKeyBase64,
        counter: 0,
        createdAt: new Date(),
      });

      logger.info('Biometric credential registered', { userId });

      return {
        success: true,
        credentialId,
      };
    } catch (error) {
      logger.error('Biometric registration failed', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Authenticate with biometric
   */
  async authenticate(userId: string): Promise<BiometricResult> {
    const availability = await this.checkAvailability();
    
    if (!availability.available) {
      return {
        success: false,
        error: 'Biometric authentication not available',
      };
    }

    try {
      // Get stored credential
      const stored = await this.getCredential(userId);
      
      if (!stored) {
        return {
          success: false,
          error: 'No credential found for user',
        };
      }

      // Generate challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Create credential request options
      const options: PublicKeyCredentialRequestOptions = {
        rpId: this.config.rpId,
        challenge,
        timeout: this.config.timeout,
        userVerification: this.config.userVerification,
        allowCredentials: [
          {
            id: this.base64ToArrayBuffer(stored.id),
            type: 'public-key',
          },
        ],
      };

      // Authenticate
      const credential = await navigator.credentials?.get({
        publicKey: options,
      }) as PublicKeyCredential;

      if (!credential) {
        return {
          success: false,
          error: 'Authentication failed',
        };
      }

      // Verify signature (in production, verify on server)
      const _response = credential.response as AuthenticatorAssertionResponse;
      
      // Update counter
      stored.counter += 1;
      await this.storeCredential(userId, stored);

      logger.info('Biometric authentication successful', { userId });

      return {
        success: true,
        credentialId: this.arrayBufferToBase64(credential.rawId),
      };
    } catch (error) {
      logger.error('Biometric authentication failed', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Remove credential
   */
  async removeCredential(userId: string): Promise<void> {
    if (typeof window === 'undefined') return;
    
    const key = `biometric_credential_${userId}`;
    localStorage.removeItem(key);
  }

  /**
   * Check if user has credential
   */
  async hasCredential(userId: string): Promise<boolean> {
    const credential = await this.getCredential(userId);
    return credential !== null;
  }

  /**
   * Store credential locally
   */
  private async storeCredential(userId: string, credential: BiometricCredential): Promise<void> {
    if (typeof window === 'undefined') return;
    
    const key = `biometric_credential_${userId}`;
    localStorage.setItem(key, JSON.stringify(credential));
  }

  /**
   * Get stored credential
   */
  private async getCredential(userId: string): Promise<BiometricCredential | null> {
    if (typeof window === 'undefined') return null;
    
    const key = `biometric_credential_${userId}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) return null;
    
    try {
      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
      };
    } catch {
      return null;
    }
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/**
 * Factory function
 */
export function createBiometricAuth(config?: Partial<BiometricConfig>): BiometricAuth {
  return new BiometricAuth(config);
}

// Export singleton instance
export const biometricAuth = new BiometricAuth();
