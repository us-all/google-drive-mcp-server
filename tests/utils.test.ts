import { describe, it, expect } from "vitest";
import {
  WriteBlockedError,
  GWSFeatureError,
  assertWriteAllowed,
  requireGWS,
  wrapToolHandler,
  enrichGoogleApiError,
} from "../src/tools/utils.js";
import type { AccountCapabilities } from "../src/capabilities.js";

describe("WriteBlockedError", () => {
  it("has correct name and message", () => {
    const err = new WriteBlockedError();
    expect(err.name).toBe("WriteBlockedError");
    expect(err.message).toContain("Write operations are disabled");
  });
});

describe("GWSFeatureError", () => {
  it("includes feature name in message", () => {
    const err = new GWSFeatureError("Labels");
    expect(err.name).toBe("GWSFeatureError");
    expect(err.message).toContain("Labels");
    expect(err.message).toContain("Google Workspace");
  });
});

describe("assertWriteAllowed", () => {
  it("throws when write is disabled", () => {
    // config.allowWrite is false by default (set in setup.ts)
    expect(() => assertWriteAllowed()).toThrow(WriteBlockedError);
  });
});

describe("requireGWS", () => {
  it("throws for personal accounts", () => {
    const caps: AccountCapabilities = {
      isGWS: false,
      domain: "gmail.com",
      email: "user@gmail.com",
      displayName: "User",
      sharedDrives: false,
      labels: false,
      contentRestrictions: true,
      driveActivity: true,
    };
    expect(() => requireGWS(caps, "Shared Drives")).toThrow(GWSFeatureError);
  });

  it("passes for GWS accounts", () => {
    const caps: AccountCapabilities = {
      isGWS: true,
      domain: "company.com",
      email: "user@company.com",
      displayName: "User",
      sharedDrives: true,
      labels: true,
      contentRestrictions: true,
      driveActivity: true,
    };
    expect(() => requireGWS(caps, "Shared Drives")).not.toThrow();
  });
});

describe("wrapToolHandler", () => {
  it("wraps successful result as MCP content", async () => {
    const handler = wrapToolHandler(async () => ({ hello: "world" }));
    const result = await handler({} as never);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ hello: "world" });
    expect(result).not.toHaveProperty("isError");
  });

  it("handles WriteBlockedError gracefully", async () => {
    const handler = wrapToolHandler(async () => {
      throw new WriteBlockedError();
    });
    const result = await handler({} as never);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Write operations are disabled");
  });

  it("handles GWSFeatureError gracefully", async () => {
    const handler = wrapToolHandler(async () => {
      throw new GWSFeatureError("Labels");
    });
    const result = await handler({} as never);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Labels");
  });

  it("sanitizes Bearer tokens in error messages", async () => {
    const handler = wrapToolHandler(async () => {
      throw new Error("Request failed: Bearer ya29.abc123xyz");
    });
    const result = await handler({} as never);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("[REDACTED]");
    expect(result.content[0].text).not.toContain("ya29.abc123xyz");
  });

  it("handles unknown errors", async () => {
    const handler = wrapToolHandler(async () => {
      throw "string error";
    });
    const result = await handler({} as never);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown error");
  });
});

describe("enrichGoogleApiError (SA + DWD hint)", () => {
  const oauthCtx = { authMethod: "oauth2", impersonateUser: "" };
  const saWithImpersonate = {
    authMethod: "service-account",
    impersonateUser: "alice@example.com",
  };
  const saNoImpersonate = {
    authMethod: "service-account",
    impersonateUser: "",
  };

  function gErr(opts: {
    message: string;
    code?: number;
    responseData?: unknown;
  }): Error & { code?: number; response?: { data?: unknown } } {
    const e = new Error(opts.message) as Error & {
      code?: number;
      response?: { data?: unknown };
    };
    if (opts.code !== undefined) e.code = opts.code;
    if (opts.responseData !== undefined) e.response = { data: opts.responseData };
    return e;
  }

  it("does not add hint for OAuth2 (no impersonation context)", () => {
    const data = enrichGoogleApiError(gErr({ message: "Forbidden", code: 403 }), oauthCtx);
    expect(data.hint).toBeUndefined();
    expect(data.status).toBe(403);
  });

  it("does not add hint for SA without impersonation", () => {
    const data = enrichGoogleApiError(
      gErr({ message: "Forbidden", code: 403 }),
      saNoImpersonate,
    );
    expect(data.hint).toBeUndefined();
  });

  it("adds DWD hint on 401 while impersonating", () => {
    const data = enrichGoogleApiError(
      gErr({ message: "Unauthorized", code: 401 }),
      saWithImpersonate,
    );
    expect(data.hint).toMatch(/Domain-wide Delegation/);
    expect(data.hint).toContain("alice@example.com");
  });

  it("adds DWD hint when error body reports unauthorized_client", () => {
    const data = enrichGoogleApiError(
      gErr({
        message: "Bad Request",
        responseData: { error: "unauthorized_client", error_description: "Client is unauthorized" },
      }),
      saWithImpersonate,
    );
    expect(data.hint).toMatch(/Domain-wide Delegation/);
  });

  it("adds permission hint on 403 while impersonating", () => {
    const data = enrichGoogleApiError(
      gErr({
        message: "The user does not have sufficient permissions for this file.",
        code: 403,
      }),
      saWithImpersonate,
    );
    expect(data.hint).toMatch(/Permission denied/);
    expect(data.hint).toContain("alice@example.com");
  });

  it("preserves status, errors, and details fields", () => {
    const data = enrichGoogleApiError(
      gErr({
        message: "Forbidden",
        code: 403,
        responseData: { error: { message: "perm" } },
      }),
      saWithImpersonate,
    );
    expect(data.status).toBe(403);
    expect(data.details).toEqual({ error: { message: "perm" } });
  });
});
