/**
 * Ambient module declarations for optional runtime dependencies.
 *
 * IMPORTANT: This file must NOT contain any top-level import/export statements.
 * Top-level imports turn a .d.ts into a module file, converting `declare module`
 * into module augmentations (which fail when the module doesn't exist).
 */

// --- Optional: playwright + axe-core (accessibility-service.ts) ---
declare module 'playwright' {
  export const chromium: {
    launch(opts?: { headless?: boolean }): Promise<{
      newPage(): Promise<{
        goto(url: string, opts?: { waitUntil?: string }): Promise<void>;
      }>;
      close(): Promise<void>;
    }>;
  };
}

declare module '@axe-core/playwright' {
  export class AxeBuilder {
    constructor(opts: { page: unknown });
    withTags(tags: string[]): this;
    analyze(): Promise<{ violations: unknown[] }>;
  }
}

// --- Optional: @sendgrid/mail ---
declare module '@sendgrid/mail' {
  const sgMail: {
    setApiKey(key: string): void;
    send(msg: Record<string, unknown>): Promise<unknown>;
  };
  export default sgMail;
}

// --- Optional: sharp (ocr-service.ts image processing) ---
declare module 'sharp' {
  interface SharpInstance {
    resize(width: number, height?: number): SharpInstance;
    grayscale(): SharpInstance;
    normalize(): SharpInstance;
    sharpen(): SharpInstance;
    toBuffer(): Promise<Buffer>;
    metadata(): Promise<{ width?: number; height?: number; format?: string }>;
  }
  function sharp(input: Buffer | string): SharpInstance;
  export default sharp;
}

// --- Optional: @azure/arm-resources (carbon-accounting-integration.ts) ---
declare module '@azure/arm-resources' {
  export class ResourceManagementClient {
    constructor(credential: unknown, subscriptionId: string);
    resources: {
      listByResourceGroup(resourceGroupName: string): AsyncIterable<{
        id?: string; type?: string; location?: string; name?: string;
      }>;
    };
  }
}
