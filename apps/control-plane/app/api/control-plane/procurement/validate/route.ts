import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";
import {
  getSigningKeyPair,
  verifyZipSignature,
} from "@nzila/platform-procurement-proof";

export const dynamic = "force-dynamic";

/**
 * Real Ed25519 verification of a procurement pack zip.
 *
 * Caller MUST supply the manifest JSON that was signed and the full
 * ZipSignature envelope (as produced by exportAsSignedZip). We then
 * recompute SHA-256(manifestJson), assert it matches signature.manifestDigest,
 * and verify the Ed25519 signature against the public key for this process.
 *
 * If the request omits the signature envelope we return 400 — we will NOT
 * return `valid: true` based on `digest` alone.
 */
const signaturePayloadSchema = z.object({
  algorithm: z.literal("Ed25519"),
  manifestDigest: z.string().min(1),
  signature: z.string().min(1),
  keyId: z.string().min(1),
  signedAt: z.string().datetime(),
  signedBy: z.string().min(1),
});

const validateSchema = z.object({
  packId: z.string().min(1),
  manifestJson: z.string().min(1),
  signature: signaturePayloadSchema,
});

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request);
    const body: unknown = await request.json();
    const parsed = validateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Provide { packId, manifestJson, signature: { algorithm, manifestDigest, signature, keyId, signedAt, signedBy } }.",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const { packId, manifestJson, signature } = parsed.data;
    const { publicKey, keyId } = getSigningKeyPair();

    if (signature.keyId !== keyId) {
      return NextResponse.json({
        ok: true,
        data: {
          packId,
          valid: false,
          reason: `Signature keyId '${signature.keyId}' does not match current verifier keyId '${keyId}'.`,
          algorithm: "ed25519",
          verifiedAt: new Date().toISOString(),
        },
      });
    }

    const valid = verifyZipSignature(manifestJson, signature, publicKey);

    return NextResponse.json({
      ok: true,
      data: {
        packId,
        valid,
        algorithm: "ed25519",
        keyId,
        verifiedAt: new Date().toISOString(),
        ...(valid
          ? {}
          : { reason: "Signature failed Ed25519 verification against current public key." }),
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
