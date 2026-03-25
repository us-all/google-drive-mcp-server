import { z } from "zod";
import { google } from "googleapis";
import { getDriveClient } from "../client.js";
import { requireGWS } from "./utils.js";
import { getCapabilities } from "../capabilities.js";

/**
 * Approvals API (GA December 2025) — googleapis SDK may not yet have
 * typed bindings, so we fall back to google.options + raw request.
 */

async function getAuthHeaders(): Promise<Record<string, string>> {
  const drive = getDriveClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auth = (drive as any).context._options.auth;
  if (typeof auth.getAccessToken === "function") {
    const tokenResponse = await auth.getAccessToken();
    const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
    return { Authorization: `Bearer ${token}` };
  }
  // For GoogleAuth (service account), get client then token
  if (typeof auth.getClient === "function") {
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
    return { Authorization: `Bearer ${token}` };
  }
  throw new Error("Unable to obtain access token for Approvals API");
}

// ── list-approvals ──────────────────────────────────────────────────────────

export const listApprovalsSchema = z.object({
  fileId: z
    .string()
    .describe("The ID of the file to list approvals for"),
  pageSize: z.coerce
    .number()
    .optional()
    .default(20)
    .describe("Maximum number of approvals to return. Default: 20"),
  pageToken: z
    .string()
    .optional()
    .describe("Token for fetching the next page of results"),
});

export async function listApprovals(
  params: z.infer<typeof listApprovalsSchema>,
) {
  const caps = getCapabilities();
  if (caps) requireGWS(caps, "Approvals");

  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams({
    pageSize: String(params.pageSize),
  });
  if (params.pageToken) searchParams.set("pageToken", params.pageToken);

  searchParams.set("fields", "*");
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.fileId)}/approvals?${searchParams}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Approvals API returned ${res.status}: ${await res.text()}`);
  }

  return await res.json();
}

// ── get-approval ────────────────────────────────────────────────────────────

export const getApprovalSchema = z.object({
  fileId: z
    .string()
    .describe("The ID of the file"),
  approvalId: z
    .string()
    .describe("The ID of the approval to retrieve"),
});

export async function getApproval(
  params: z.infer<typeof getApprovalSchema>,
) {
  const caps = getCapabilities();
  if (caps) requireGWS(caps, "Approvals");

  const headers = await getAuthHeaders();
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.fileId)}/approvals/${encodeURIComponent(params.approvalId)}?fields=*`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Approvals API returned ${res.status}: ${await res.text()}`);
  }

  return await res.json();
}
