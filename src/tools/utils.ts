import { createWrapToolHandler } from "@us-all/mcp-toolkit";
import { config } from "../config.js";
import type { AccountCapabilities } from "../capabilities.js";

export class WriteBlockedError extends Error {
  constructor() {
    super(
      "Write operations are disabled. Set GOOGLE_DRIVE_ALLOW_WRITE=true to enable.",
    );
    this.name = "WriteBlockedError";
  }
}

export class GWSFeatureError extends Error {
  constructor(feature: string) {
    super(
      `'${feature}' requires Google Workspace. This feature is not available for personal Google accounts.`,
    );
    this.name = "GWSFeatureError";
  }
}

export function assertWriteAllowed(): void {
  if (!config.allowWrite) {
    throw new WriteBlockedError();
  }
}

export function requireGWS(
  capabilities: AccountCapabilities,
  feature: string,
): void {
  if (!capabilities.isGWS) {
    throw new GWSFeatureError(feature);
  }
}

export const wrapToolHandler = createWrapToolHandler({
  // Defaults already cover bearer tokens, api_key, password, secret, token, etc.
  // Add Google-specific `key=<value>` query-string pattern.
  redactionPatterns: [/key=[A-Za-z0-9\-._~+/]+=*/g],
  errorExtractors: [
    {
      match: (error: unknown) => error instanceof WriteBlockedError,
      extract: (error: unknown) => ({
        kind: "passthrough",
        text: (error as Error).message,
      }),
    },
    {
      match: (error: unknown) => error instanceof GWSFeatureError,
      extract: (error: unknown) => ({
        kind: "passthrough",
        text: (error as Error).message,
      }),
    },
    {
      // Google API errors expose `code`, `errors`, and `response.data`.
      match: (error: unknown) => error instanceof Error,
      extract: (error: unknown) => {
        const err = error as Error & {
          code?: number;
          errors?: unknown[];
          response?: { data?: unknown };
        };
        const data: Record<string, unknown> & { message: string } = {
          message: err.message,
        };
        if (err.code !== undefined) data.status = err.code;
        if (err.errors !== undefined) data.errors = err.errors;
        if (err.response?.data !== undefined) data.details = err.response.data;
        return { kind: "structured", data };
      },
    },
    {
      // Non-Error throws (strings, etc.) — preserve legacy "Unknown error" message.
      match: () => true,
      extract: () => ({
        kind: "structured",
        data: { message: "Unknown error" },
      }),
    },
  ],
});
