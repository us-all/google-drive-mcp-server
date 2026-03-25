import { z } from "zod";
import { getDriveClient } from "../client.js";
import { assertWriteAllowed } from "./utils.js";

// ── list-comments ───────────────────────────────────────────────────────────

export const listCommentsSchema = z.object({
  fileId: z.string().describe("The ID of the file to list comments for"),
  pageSize: z.coerce
    .number()
    .optional()
    .default(20)
    .describe("Maximum number of comments to return (1-100). Default: 20"),
  pageToken: z
    .string()
    .optional()
    .describe("Token for fetching the next page of results"),
  includeDeleted: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to include deleted comments. Default: false"),
});

export async function listComments(
  params: z.infer<typeof listCommentsSchema>,
) {
  const drive = getDriveClient();

  const response = await drive.comments.list({
    fileId: params.fileId,
    pageSize: params.pageSize,
    pageToken: params.pageToken,
    includeDeleted: params.includeDeleted,
    fields:
      "nextPageToken,comments(id,content,author(displayName,emailAddress),createdTime,modifiedTime,resolved,replies(id,content,author(displayName,emailAddress),createdTime))",
  });

  return {
    comments: response.data.comments ?? [],
    nextPageToken: response.data.nextPageToken,
    count: response.data.comments?.length ?? 0,
  };
}

// ── get-comment ─────────────────────────────────────────────────────────────

export const getCommentSchema = z.object({
  fileId: z.string().describe("The ID of the file"),
  commentId: z.string().describe("The ID of the comment"),
});

export async function getComment(params: z.infer<typeof getCommentSchema>) {
  const drive = getDriveClient();

  const response = await drive.comments.get({
    fileId: params.fileId,
    commentId: params.commentId,
    fields:
      "id,content,author(displayName,emailAddress),createdTime,modifiedTime,resolved,quotedFileContent,anchor,replies(id,content,author(displayName,emailAddress),createdTime)",
  });

  return response.data;
}

// ── create-comment ──────────────────────────────────────────────────────────

export const createCommentSchema = z.object({
  fileId: z.string().describe("The ID of the file to comment on"),
  content: z.string().describe("The text content of the comment"),
});

export async function createComment(
  params: z.infer<typeof createCommentSchema>,
) {
  assertWriteAllowed();
  const drive = getDriveClient();

  const response = await drive.comments.create({
    fileId: params.fileId,
    requestBody: { content: params.content },
    fields:
      "id,content,author(displayName,emailAddress),createdTime",
  });

  return response.data;
}

// ── resolve-comment ─────────────────────────────────────────────────────────

export const resolveCommentSchema = z.object({
  fileId: z.string().describe("The ID of the file"),
  commentId: z
    .string()
    .describe("The ID of the comment to resolve"),
});

export async function resolveComment(
  params: z.infer<typeof resolveCommentSchema>,
) {
  assertWriteAllowed();
  const drive = getDriveClient();

  // Drive API requires content field on update — fetch existing content first
  const existing = await drive.comments.get({
    fileId: params.fileId,
    commentId: params.commentId,
    fields: "content",
  });

  const response = await drive.comments.update({
    fileId: params.fileId,
    commentId: params.commentId,
    requestBody: { content: existing.data.content ?? "", resolved: true },
    fields: "id,content,resolved,modifiedTime",
  });

  return response.data;
}
