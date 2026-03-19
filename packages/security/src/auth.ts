import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Service-to-service authentication via HMAC-signed tokens.
 *
 * Each service has a shared secret. Requests carry:
 *   - `x-service-id` header
 *   - `x-service-signature` header (HMAC-SHA256 of body)
 *   - `x-service-timestamp` header (ISO-8601, must be within clock skew window)
 */

export interface ServiceCredential {
  serviceId: string;
  secret: string; // shared secret
}

export interface ServiceAuthConfig {
  /** Max clock skew in ms (default 30 s). */
  maxClockSkewMs?: number;
}

const DEFAULT_CLOCK_SKEW_MS = 30_000;

export class ServiceAuthVerifier {
  private readonly credentials = new Map<string, string>();
  private readonly maxClockSkewMs: number;

  constructor(
    credentials: ServiceCredential[],
    config?: ServiceAuthConfig,
  ) {
    for (const c of credentials) {
      this.credentials.set(c.serviceId, c.secret);
    }
    this.maxClockSkewMs = config?.maxClockSkewMs ?? DEFAULT_CLOCK_SKEW_MS;
  }

  /**
   * Verify request headers.
   * Returns the service ID on success, or throws.
   */
  verify(headers: {
    "x-service-id"?: string;
    "x-service-signature"?: string;
    "x-service-timestamp"?: string;
  }, body: string): string {
    const serviceId = headers["x-service-id"];
    const signature = headers["x-service-signature"];
    const timestamp = headers["x-service-timestamp"];

    if (!serviceId || !signature || !timestamp) {
      throw new ServiceAuthError("Missing service auth headers");
    }

    const secret = this.credentials.get(serviceId);
    if (!secret) {
      throw new ServiceAuthError("Unknown service ID");
    }

    // Clock skew check
    const ts = new Date(timestamp).getTime();
    if (Number.isNaN(ts)) {
      throw new ServiceAuthError("Invalid timestamp");
    }
    if (Math.abs(Date.now() - ts) > this.maxClockSkewMs) {
      throw new ServiceAuthError("Timestamp outside allowed clock skew");
    }

    // HMAC verification
    const payload = `${timestamp}.${body}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      throw new ServiceAuthError("Invalid signature");
    }

    return serviceId;
  }

  /**
   * Sign an outgoing request.
   */
  static sign(
    serviceId: string,
    secret: string,
    body: string,
  ): {
    "x-service-id": string;
    "x-service-signature": string;
    "x-service-timestamp": string;
  } {
    const timestamp = new Date().toISOString();
    const payload = `${timestamp}.${body}`;
    const signature = createHmac("sha256", secret).update(payload).digest("hex");
    return {
      "x-service-id": serviceId,
      "x-service-signature": signature,
      "x-service-timestamp": timestamp,
    };
  }
}

export class ServiceAuthError extends Error {
  public readonly code = "SERVICE_AUTH_FAILED" as const;
  constructor(message: string) {
    super(message);
    this.name = "ServiceAuthError";
  }
}
