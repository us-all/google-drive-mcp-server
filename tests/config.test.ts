import { describe, it, expect, beforeEach } from "vitest";

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
