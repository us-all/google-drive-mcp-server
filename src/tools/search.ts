import { z } from "zod";
import { getDriveClient } from "../client.js";
import { extractFieldsDescription } from "./extract-fields.js";

const ef = z.string().optional().describe(extractFieldsDescription);

const FILE_FIELDS =
  "id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,owners,shared";

// ── search-files ────────────────────────────────────────────────────────────

export const searchFilesSchema = z.object({
  query: z
    .string()
    .describe(
      "Search query. Supports Google Drive query syntax. Examples: \"name contains 'report'\", \"fullText contains 'budget'\", \"mimeType = 'application/pdf'\", \"modifiedTime > '2024-01-01'\"",
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
  corpora: z
    .enum(["user", "drive", "domain", "allDrives"])
    .optional()
    .default("user")
    .describe(
      "Search scope. 'user': My Drive + shared with me. 'drive': specific Shared Drive (requires driveId). 'domain': all files in the GWS domain. 'allDrives': My Drive + all Shared Drives. Default: 'user'",
    ),
  driveId: z
    .string()
    .optional()
    .describe("Shared Drive ID. Required when corpora is 'drive'"),
  orderBy: z
    .string()
    .optional()
    .default("relevance")
    .describe(
      "Sort order. Options: 'relevance', 'modifiedTime desc', 'name', 'createdTime desc'. Default: 'relevance'",
    ),
  extractFields: ef,
});

export async function searchFiles(
  params: z.infer<typeof searchFilesSchema>,
) {
  const drive = getDriveClient();

  // If query looks like raw text (no Drive query operators), wrap in fullText contains
  const driveQueryOperators = /\b(contains|=|!=|<|>|<=|>=|in|not|has|and|or)\b/i;
  const q = driveQueryOperators.test(params.query)
    ? `${params.query} and trashed = false`
    : `fullText contains '${params.query.replace(/'/g, "\\'")}' and trashed = false`;

  const options: Record<string, unknown> = {
    q,
    pageSize: params.pageSize,
    pageToken: params.pageToken,
    fields: `nextPageToken,files(${FILE_FIELDS})`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: params.corpora,
  };

  if (params.driveId) {
    options.driveId = params.driveId;
  }

  if (params.orderBy !== "relevance") {
    options.orderBy = params.orderBy;
  }

  const response = await drive.files.list(options);

  return {
    files: response.data.files ?? [],
    nextPageToken: response.data.nextPageToken,
    count: response.data.files?.length ?? 0,
  };
}

// ── search-shared-drives ────────────────────────────────────────────────────

export const searchSharedDrivesSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      "Search query for Shared Drives. Example: \"name contains 'Engineering'\". If omitted, lists all accessible Shared Drives",
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

export async function searchSharedDrives(
  params: z.infer<typeof searchSharedDrivesSchema>,
) {
  const drive = getDriveClient();

  const response = await drive.drives.list({
    q: params.query,
    pageSize: params.pageSize,
    pageToken: params.pageToken,
    fields: "nextPageToken,drives(id,name,createdTime,hidden,restrictions,capabilities)",
  });

  return {
    drives: response.data.drives ?? [],
    nextPageToken: response.data.nextPageToken,
    count: response.data.drives?.length ?? 0,
  };
}
