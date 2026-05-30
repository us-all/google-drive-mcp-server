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

export interface AuthContext {
  authMethod: string;
  impersonateUser: string;
}

interface GoogleApiError extends Error {
  code?: number;
  errors?: unknown[];
  response?: { data?: unknown };
}

export function enrichGoogleApiError(
  err: GoogleApiError,
  ctx: AuthContext,
): Record<string, unknown> & { message: string } {
  const data: Record<string, unknown> & { message: string } = {
    message: err.message,
  };
  if (err.code !== undefined) data.status = err.code;
  if (err.errors !== undefined) data.errors = err.errors;
  if (err.response?.data !== undefined) data.details = err.response.data;

  const isImpersonating =
    ctx.authMethod === "service-account" && Boolean(ctx.impersonateUser);
  if (!isImpersonating) return data;

  const probe = `${err.message ?? ""} ${JSON.stringify(
    err.response?.data ?? {},
  )}`.toLowerCase();
  const looksLikeDwdMiss =
    err.code === 401 ||
    /unauthorized_client|invalid_grant|invalid\s+subject|caller does not have/.test(
      probe,
    );

  if (looksLikeDwdMiss) {
    data.hint = `Service account impersonation failed for "${ctx.impersonateUser}". Verify (1) the SA client ID is authorized for the required scopes in Google Workspace Admin → Security → API controls → Domain-wide Delegation, and (2) GOOGLE_IMPERSONATE_USER is a real, active user in the impersonated domain.`;
  } else if (err.code === 403) {
    data.hint = `Permission denied while impersonating "${ctx.impersonateUser}". Either the impersonated user lacks direct access to this resource, or the DWD scope grant is narrower than the API call needs. Confirm the user can open the resource in Drive/Docs UI as themselves.`;
  }
  return data;
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
      extract: (error: unknown) => ({
        kind: "structured",
        data: enrichGoogleApiError(error as GoogleApiError, {
          authMethod: config.authMethod,
          impersonateUser: config.impersonateUser,
        }),
      }),
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
