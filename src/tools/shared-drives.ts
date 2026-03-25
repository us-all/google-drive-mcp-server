import { z } from "zod";
import { getDriveClient } from "../client.js";
import { assertWriteAllowed, requireGWS } from "./utils.js";
import { getCapabilities } from "../capabilities.js";

// ── list-shared-drives ──────────────────────────────────────────────────────

export const listSharedDrivesSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      "Filter query for Shared Drives. Example: \"name contains 'Engineering'\". If omitted, lists all accessible Shared Drives",
    ),
  pageSize: z.coerce
    .number()
    .optional()
    .default(20)
    .describe("Maximum number of results (1-100). Default: 20"),
  pageToken: z
    .string()
    .optional()
    .describe("Token for fetching the next page of results"),
});

export async function listSharedDrives(
  params: z.infer<typeof listSharedDrivesSchema>,
) {
  const caps = getCapabilities();
  if (caps) requireGWS(caps, "Shared Drives");

  const drive = getDriveClient();

  const response = await drive.drives.list({
    q: params.query,
    pageSize: params.pageSize,
    pageToken: params.pageToken,
    fields:
      "nextPageToken,drives(id,name,createdTime,hidden,restrictions,capabilities,backgroundImageLink,colorRgb)",
  });

  return {
    drives: response.data.drives ?? [],
    nextPageToken: response.data.nextPageToken,
    count: response.data.drives?.length ?? 0,
  };
}

// ── get-shared-drive ────────────────────────────────────────────────────────

export const getSharedDriveSchema = z.object({
  driveId: z.string().describe("The ID of the Shared Drive"),
});

export async function getSharedDrive(
  params: z.infer<typeof getSharedDriveSchema>,
) {
  const caps = getCapabilities();
  if (caps) requireGWS(caps, "Shared Drives");

  const drive = getDriveClient();

  const response = await drive.drives.get({
    driveId: params.driveId,
    fields:
      "id,name,createdTime,hidden,restrictions,capabilities,backgroundImageLink,colorRgb",
  });

  return response.data;
}

// ── create-shared-drive ─────────────────────────────────────────────────────

export const createSharedDriveSchema = z.object({
  name: z.string().describe("Name of the Shared Drive to create"),
});

export async function createSharedDrive(
  params: z.infer<typeof createSharedDriveSchema>,
) {
  assertWriteAllowed();
  const caps = getCapabilities();
  if (caps) requireGWS(caps, "Shared Drives");

  const drive = getDriveClient();

  // Google requires a unique requestId for idempotency
  const requestId = crypto.randomUUID();

  const response = await drive.drives.create({
    requestId,
    requestBody: {
      name: params.name,
    },
    fields: "id,name,createdTime,capabilities",
  });

  return response.data;
}
