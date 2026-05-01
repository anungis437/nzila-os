import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Validates that incoming API requests include the correct internal API key.
 * Control-plane is an internal-only admin surface — all API routes must
 * call this guard before returning data.
 *
 * Set CONTROL_PLANE_API_KEY in the environment; requests must send it
 * via the `x-api-key` header.
 */
export async function requireApiAuth(request?: Request) {
  const apiKey = process.env.CONTROL_PLANE_API_KEY;

  // In development without a key configured, allow access
  if (!apiKey && process.env.NODE_ENV === "development") {
    return { authenticated: true };
  }

  if (!apiKey) {
    throw new ApiAuthError("Server misconfiguration: CONTROL_PLANE_API_KEY not set", 500);
  }

  const provided = request?.headers.get("x-api-key");

  if (!provided || provided !== apiKey) {
    throw new ApiAuthError("Unauthorized", 401);
  }

  return { authenticated: true };
}

export class ApiAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
  }
}

export class RequestValidationError extends Error {
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>, status = 400) {
    super(message);
    this.name = "RequestValidationError";
    this.status = status;
    this.details = details;
  }
}

export function parseUuidParam(value: string | null | undefined, field: string): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) {
    throw new RequestValidationError(`${field} must be a valid UUID`, {
      field,
      reason: "invalid_uuid",
    });
  }
  return result.data;
}

export function handleAuthError(error: unknown) {
  if (error instanceof ApiAuthError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }
  if (error instanceof RequestValidationError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        details: error.details,
      },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { ok: false, error: "Internal server error" },
    { status: 500 },
  );
}
