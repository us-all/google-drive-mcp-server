import { describe, it, expect, beforeEach } from "vitest";
import { validateServiceAccountKey, resolveServiceAccountPath } from "../src/sa-validation.js";

describe("config", () => {
  beforeEach(() => {
    // Reset modules to re-evaluate config with fresh env
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    delete process.env.GOOGLE_DRIVE_ALLOW_WRITE;
    delete process.env.GOOGLE_DRIVE_SCOPES;
  });

  it("detects oauth2 when client credentials are set", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    process.env.GOOGLE_REFRESH_TOKEN = "test-token";

    const { config } = await import("../src/config.js");
    expect(config.authMethod).toBe("oauth2");
    expect(config.clientId).toBe("test-id");
  });

  it("has write disabled by default", async () => {
    const { config } = await import("../src/config.js");
    expect(config.allowWrite).toBe(false);
  });
});

function makeFs(files: Record<string, string | "missing">) {
  return {
    existsSync: (p: string) => files[p] !== undefined && files[p] !== "missing",
    readFileSync: (p: string, _enc: BufferEncoding) => {
      const v = files[p];
      if (v === undefined || v === "missing") throw new Error(`ENOENT: ${p}`);
      return v;
    },
  };
}

const VALID_SA = JSON.stringify({
  type: "service_account",
  project_id: "us-all-prod",
  private_key_id: "abc",
  private_key: "-----BEGIN PRIVATE KEY-----\nfoo\n-----END PRIVATE KEY-----\n",
  client_email: "drive-mcp@us-all-prod.iam.gserviceaccount.com",
  client_id: "12345",
});

describe("validateServiceAccountKey", () => {
  it("accepts a valid SA key file", () => {
    const fsImpl = makeFs({ "/sa.json": VALID_SA });
    const result = validateServiceAccountKey("/sa.json", fsImpl);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.clientEmail).toBe("drive-mcp@us-all-prod.iam.gserviceaccount.com");
      expect(result.projectId).toBe("us-all-prod");
    }
  });

  it("rejects empty path", () => {
    const result = validateServiceAccountKey("", makeFs({}));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/empty/);
  });

  it("rejects missing file", () => {
    const result = validateServiceAccountKey("/missing.json", makeFs({ "/missing.json": "missing" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found/);
  });

  it("rejects invalid JSON", () => {
    const result = validateServiceAccountKey("/bad.json", makeFs({ "/bad.json": "{not json" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid JSON/);
  });

  it("rejects wrong type (e.g. authorized_user instead of service_account)", () => {
    const fsImpl = makeFs({
      "/oauth.json": JSON.stringify({ type: "authorized_user", client_id: "x", refresh_token: "y" }),
    });
    const result = validateServiceAccountKey("/oauth.json", fsImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/wrong type.*service_account.*authorized_user/);
  });

  it("rejects SA missing required fields", () => {
    const fsImpl = makeFs({
      "/incomplete.json": JSON.stringify({ type: "service_account", project_id: "p" }),
    });
    const result = validateServiceAccountKey("/incomplete.json", fsImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/missing required field: client_email/);
  });
});

describe("resolveServiceAccountPath", () => {
  it("prefers GOOGLE_SERVICE_ACCOUNT_KEY_PATH when set", () => {
    const fsImpl = makeFs({ "/explicit.json": VALID_SA, "/gac.json": VALID_SA });
    const path = resolveServiceAccountPath(
      { GOOGLE_SERVICE_ACCOUNT_KEY_PATH: "/explicit.json", GOOGLE_APPLICATION_CREDENTIALS: "/gac.json" },
      fsImpl,
    );
    expect(path).toBe("/explicit.json");
  });

  it("falls back to GOOGLE_APPLICATION_CREDENTIALS when it points to a valid SA file", () => {
    const fsImpl = makeFs({ "/gac.json": VALID_SA });
    const path = resolveServiceAccountPath({ GOOGLE_APPLICATION_CREDENTIALS: "/gac.json" }, fsImpl);
    expect(path).toBe("/gac.json");
  });

  it("does NOT pick up GOOGLE_APPLICATION_CREDENTIALS when it points to an authorized_user (ADC) file", () => {
    const fsImpl = makeFs({
      "/adc.json": JSON.stringify({ type: "authorized_user", client_id: "x", refresh_token: "y", client_secret: "z" }),
    });
    const path = resolveServiceAccountPath({ GOOGLE_APPLICATION_CREDENTIALS: "/adc.json" }, fsImpl);
    expect(path).toBe("");
  });

  it("returns empty string when neither env var is set", () => {
    expect(resolveServiceAccountPath({}, makeFs({}))).toBe("");
  });
});
