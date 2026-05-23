import { NextResponse } from "next/server";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";
import { getSigningKeyPair } from "@nzila/platform-procurement-proof";

export const dynamic = "force-dynamic";

/**
 * Returns the public half of the Ed25519 procurement signing key.
 * - In production the private key MUST come from PROCUREMENT_SIGNING_KEY
 *   (PEM, pkcs8). If missing we fail closed rather than handing out an
 *   ephemeral key that nobody can later verify against.
 * - In dev/CI getSigningKeyPair() caches an ephemeral pair for the process
 *   lifetime. `ephemeral: true` is surfaced so callers can tell it is
 *   non-durable.
 */
export async function GET(request: Request) {
  try {
    await requireApiAuth(request);

    const hasEnvKey = !!process.env.PROCUREMENT_SIGNING_KEY;
    if (!hasEnvKey && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "PROCUREMENT_SIGNING_KEY is not configured. Refusing to issue an ephemeral procurement signing key in production.",
        },
        { status: 503 },
      );
    }

    const { publicKey, keyId } = getSigningKeyPair();
    return NextResponse.json({
      ok: true,
      data: {
        algorithm: "ed25519",
        keyId,
        publicKey,
        ephemeral: !hasEnvKey,
        issuedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
