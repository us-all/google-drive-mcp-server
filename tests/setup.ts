import { beforeAll } from "vitest";

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REFRESH_TOKEN = "test-refresh-token";
});
