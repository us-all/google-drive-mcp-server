import { config } from "../config.js";
import type { AccountCapabilities } from "../capabilities.js";
import { applyExtractFields } from "./extract-fields.js";

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

function sanitize(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, "Bearer [REDACTED]")
    .replace(/key=[A-Za-z0-9\-._~+/]+/g, "key=[REDACTED]");
}

export function wrapToolHandler<T>(
  fn: (params: T) => Promise<unknown>,
) {
  return async (params: T) => {
    try {
      const result = await fn(params);
      const expr = (params as Record<string, unknown> | undefined)?.extractFields;
      const projected = typeof expr === "string" ? applyExtractFields(result, expr) : result;
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(projected, null, 2) },
        ],
      };
    } catch (error: unknown) {
      if (error instanceof WriteBlockedError || error instanceof GWSFeatureError) {
        return {
          content: [{ type: "text" as const, text: error.message }],
          isError: true,
        };
      }

      const structured: Record<string, unknown> = { message: "Unknown error" };

      if (error instanceof Error) {
        structured.message = sanitize(error.message);

        // Google API errors often have response.data
        const apiError = error as Error & {
          code?: number;
          errors?: unknown[];
          response?: { data?: unknown };
        };
        if (apiError.code) {
          structured.status = apiError.code;
        }
        if (apiError.errors) {
          structured.errors = apiError.errors;
        }
        if (apiError.response?.data) {
          structured.details = apiError.response.data;
        }
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(structured, null, 2) },
        ],
        isError: true,
      };
    }
  };
}
