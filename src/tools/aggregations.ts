import { z } from "zod";
import { getDriveClient, getDocsClient } from "../client.js";
import { extractFieldsDescription } from "./extract-fields.js";

const ef = z.string().optional().describe(extractFieldsDescription);

/**
 * Aggregation tools — round-trip elimination.
 *
 * `summarize-doc` consolidates: file metadata + extracted text content +
 * permissions + comments in a single call.
 */

export const summarizeDocSchema = z.object({
  documentId: z.string().describe("Google Docs document ID"),
  includeContent: z.boolean().optional().default(true).describe("Include extracted plain-text content (default true)"),
  includePermissions: z.boolean().optional().default(true).describe("Include sharing permissions (default true)"),
  includeComments: z.boolean().optional().default(false).describe("Include comments (default false)"),
  maxCommentPages: z.coerce.number().optional().default(1).describe("Max pages of comments to fetch (default 1, page size 100)"),
  extractFields: ef,
});

interface DocsBody {
  body?: { content?: Array<{ paragraph?: { elements?: Array<{ textRun?: { content?: string } }> } }> };
}

function extractText(doc: DocsBody): string {
  const out: string[] = [];
  for (const block of doc.body?.content ?? []) {
    for (const el of block.paragraph?.elements ?? []) {
      const t = el.textRun?.content;
      if (t) out.push(t);
    }
  }
  return out.join("");
}

export async function summarizeDoc(params: z.infer<typeof summarizeDocSchema>) {
  const drive = getDriveClient();
  const docs = getDocsClient();
  const docId = params.documentId;

  const [metaR, docR, permR, commentsR] = await Promise.allSettled([
    drive.files.get({
      fileId: docId,
      fields: "id,name,mimeType,createdTime,modifiedTime,owners,size,webViewLink,description,starred",
      supportsAllDrives: true,
    }),
    params.includeContent
      ? docs.documents.get({ documentId: docId, includeTabsContent: true })
      : Promise.resolve(null),
    params.includePermissions
      ? drive.permissions.list({ fileId: docId, fields: "permissions(id,type,role,emailAddress,displayName)", supportsAllDrives: true })
      : Promise.resolve(null),
    params.includeComments
      ? drive.comments.list({ fileId: docId, fields: "comments(id,content,author,createdTime,resolved)", pageSize: 100 })
      : Promise.resolve(null),
  ]);

  const meta = metaR.status === "fulfilled" ? metaR.value?.data : null;
  const doc = docR.status === "fulfilled" && docR.value ? docR.value.data : null;
  const perms = permR.status === "fulfilled" && permR.value ? permR.value.data : null;
  const comments = commentsR.status === "fulfilled" && commentsR.value ? commentsR.value.data : null;

  const text = doc ? extractText(doc as DocsBody) : null;

  return {
    metadata: meta,
    content: text,
    permissions: (perms as { permissions?: unknown[] } | null)?.permissions ?? null,
    comments: (comments as { comments?: unknown[] } | null)?.comments ?? null,
    summary: {
      title: (meta as { name?: string } | null)?.name ?? "",
      ownerEmails: ((meta as { owners?: Array<{ emailAddress?: string }> } | null)?.owners ?? []).map((o) => o.emailAddress).filter(Boolean),
      modifiedTime: (meta as { modifiedTime?: string } | null)?.modifiedTime ?? null,
      contentLength: text?.length ?? 0,
      sharedWith: (perms as { permissions?: unknown[] } | null)?.permissions?.length ?? 0,
      commentCount: (comments as { comments?: unknown[] } | null)?.comments?.length ?? 0,
    },
  };
}
