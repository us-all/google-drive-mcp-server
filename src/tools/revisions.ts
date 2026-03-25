import { z } from "zod";
import { getDriveClient } from "../client.js";

// ── list-revisions ──────────────────────────────────────────────────────────

export const listRevisionsSchema = z.object({
  fileId: z
    .string()
    .describe("The ID of the file to list revisions for"),
  pageSize: z.coerce
    .number()
    .optional()
    .default(20)
    .describe("Maximum number of revisions to return (1-200). Default: 20"),
  pageToken: z
    .string()
    .optional()
    .describe("Token for fetching the next page of results"),
});

export async function listRevisions(
  params: z.infer<typeof listRevisionsSchema>,
) {
  const drive = getDriveClient();

  const response = await drive.revisions.list({
    fileId: params.fileId,
    pageSize: params.pageSize,
    pageToken: params.pageToken,
    fields:
      "nextPageToken,revisions(id,mimeType,modifiedTime,keepForever,published,lastModifyingUser(displayName,emailAddress),size,originalFilename)",
  });

  return {
    revisions: response.data.revisions ?? [],
    nextPageToken: response.data.nextPageToken,
    count: response.data.revisions?.length ?? 0,
  };
}

// ── get-revision ────────────────────────────────────────────────────────────

export const getRevisionSchema = z.object({
  fileId: z
    .string()
    .describe("The ID of the file"),
  revisionId: z
    .string()
    .describe("The ID of the revision. Use 'head' for the latest revision"),
});

export async function getRevision(
  params: z.infer<typeof getRevisionSchema>,
) {
  const drive = getDriveClient();

  const response = await drive.revisions.get({
    fileId: params.fileId,
    revisionId: params.revisionId,
    fields:
      "id,mimeType,modifiedTime,keepForever,published,publishedOutsideDomain,lastModifyingUser(displayName,emailAddress),size,originalFilename,exportLinks",
  });

  return response.data;
}
