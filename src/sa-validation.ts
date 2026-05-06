/**
 * Pure helpers for resolving + validating Google service account JSON key files.
 *
 * Lives outside `config.ts` so that tests can import the validators without
 * triggering `config.ts`'s top-level `dotenv.config()` + auth-method singleton —
 * the singleton resolves env once at first import, which races setup files and
 * leads to flaky test order.
 */

import fs from "fs";

export interface ServiceAccountFileShape {
  type?: string;
  client_email?: string;
  private_key?: string;
  project_id?: string;
}

export type SaKeyValidation =
  | { ok: true; clientEmail: string; projectId: string }
  | { ok: false; error: string };

export interface FsLike {
  existsSync(p: string): boolean;
  readFileSync(p: string, e: BufferEncoding): string;
}

/** Validate a Google service account JSON key file. Pure — `fsImpl` injectable for tests. */
export function validateServiceAccountKey(
  keyPath: string,
  fsImpl: FsLike = fs,
): SaKeyValidation {
  if (!keyPath) return { ok: false, error: "service account key path is empty" };
  if (!fsImpl.existsSync(keyPath)) return { ok: false, error: `file not found: ${keyPath}` };
  let data: ServiceAccountFileShape;
  try {
    data = JSON.parse(fsImpl.readFileSync(keyPath, "utf-8")) as ServiceAccountFileShape;
  } catch (err) {
    return {
      ok: false,
      error: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (data.type !== "service_account") {
    return {
      ok: false,
      error: `wrong type: expected "service_account", got "${String(data.type)}"`,
    };
  }
  for (const field of ["client_email", "private_key", "project_id"] as const) {
    if (!data[field]) return { ok: false, error: `missing required field: ${field}` };
  }
  return {
    ok: true,
    clientEmail: data.client_email!,
    projectId: data.project_id!,
  };
}

/**
 * Resolve the service account key path. Honors `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` first,
 * then falls back to `GOOGLE_APPLICATION_CREDENTIALS` if it points to a valid SA file
 * (industry-standard env var that the official `google-auth-library` also reads —
 * but only when the file is genuinely a service_account, not an authorized_user/ADC file).
 */
export function resolveServiceAccountPath(
  env: { GOOGLE_SERVICE_ACCOUNT_KEY_PATH?: string; GOOGLE_APPLICATION_CREDENTIALS?: string },
  fsImpl: FsLike = fs,
): string {
  const explicit = env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH ?? "";
  if (explicit) return explicit;
  const gac = env.GOOGLE_APPLICATION_CREDENTIALS ?? "";
  if (gac && validateServiceAccountKey(gac, fsImpl).ok) return gac;
  return "";
}
