import { z } from "zod";
import { getDriveClient } from "../client.js";
import { assertWriteAllowed } from "./utils.js";
import { applyExtractFields, extractFieldsDescription } from "./extract-fields.js";

const FILE_FIELDS =
  "id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,owners,shared,trashed,capabilities,contentRestrictions";

// ── list-files ──────────────────────────────────────────────────────────────

export const listFilesSchema = z.object({
  folderId: z
    .string()
    .optional()
    .default("root")
    .describe("Folder ID to list files from. Default: 'root'"),
  pageSize: z.coerce
    .number()
    .optional()
    .default(20)
    .describe("Maximum number of files to return (1-100). Default: 20"),
  pageToken: z
    .string()
    .optional()
    .describe("Token for fetching the next page of results"),
  orderBy: z
    .string()
    .optional()
    .default("modifiedTime desc")
    .describe("Sort order (e.g. 'modifiedTime desc', 'name', 'createdTime desc')"),
  extractFields: z.string().optional().describe(extractFieldsDescription),
});

export async function listFiles(params: z.infer<typeof listFilesSchema>) {
  const drive = getDriveClient();
  const response = await drive.files.list({
    q: `'${params.folderId}' in parents and trashed = false`,
    pageSize: params.pageSize,
    pageToken: params.pageToken,
    orderBy: params.orderBy,
    fields: `nextPageToken,files(${FILE_FIELDS})`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const result = {
    files: response.data.files ?? [],
    nextPageToken: response.data.nextPageToken,
    count: response.data.files?.length ?? 0,
  };
  return applyExtractFields(result, params.extractFields);
}

// ── get-file ────────────────────────────────────────────────────────────────

export const getFileSchema = z.object({
  fileId: z.string().describe("The ID of the file to retrieve metadata for"),
  extractFields: z.string().optional().describe(extractFieldsDescription),
});

const GET_FILE_DEFAULT_FIELDS = "id,name,mimeType,modifiedTime,size,owners,parents";

export async function getFile(params: z.infer<typeof getFileSchema>) {
  const drive = getDriveClient();
  const response = await drive.files.get({
    fileId: params.fileId,
    fields: `${FILE_FIELDS},description,starred,properties,appProperties,shortcutDetails`,
    supportsAllDrives: true,
  });
  return applyExtractFields(response.data, params.extractFields ?? GET_FILE_DEFAULT_FIELDS);
}

// ── read-file ───────────────────────────────────────────────────────────────

const GOOGLE_MIME_EXPORT_MAP: Record<string, { mimeType: string; ext: string }> = {
  "application/vnd.google-apps.document": {
    mimeType: "text/markdown",
    ext: "md",
  },
  "application/vnd.google-apps.spreadsheet": {
    mimeType: "text/csv",
    ext: "csv",
  },
  "application/vnd.google-apps.presentation": {
    mimeType: "text/plain",
    ext: "txt",
  },
  "application/vnd.google-apps.drawing": {
    mimeType: "application/pdf",
    ext: "pdf",
  },
};

export const readFileSchema = z.object({
  fileId: z.string().describe("The ID of the file to read content from"),
  mimeType: z
    .string()
    .optional()
    .describe("Export MIME type (auto-detected for Google native files)"),
});

export async function readFile(params: z.infer<typeof readFileSchema>) {
  const drive = getDriveClient();

  // First get file metadata to determine type
  const meta = await drive.files.get({
    fileId: params.fileId,
    fields: "id,name,mimeType,size",
    supportsAllDrives: true,
  });

  const fileMimeType = meta.data.mimeType ?? "";
  const isGoogleNative = fileMimeType.startsWith("application/vnd.google-apps.");

  if (isGoogleNative) {
    const exportConfig = GOOGLE_MIME_EXPORT_MAP[fileMimeType];
    const exportMimeType = params.mimeType ?? exportConfig?.mimeType ?? "text/plain";

    const exported = await drive.files.export({
      fileId: params.fileId,
      mimeType: exportMimeType,
    });

    return {
      id: meta.data.id,
      name: meta.data.name,
      mimeType: fileMimeType,
      exportedAs: exportMimeType,
      content: exported.data,
    };
  }

  // Binary/text files — read content directly
  const fileSize = parseInt(meta.data.size ?? "0", 10);
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB limit for MCP responses
  if (fileSize > MAX_SIZE) {
    return {
      id: meta.data.id,
      name: meta.data.name,
      mimeType: fileMimeType,
      size: fileSize,
      error: `File too large (${(fileSize / 1024 / 1024).toFixed(1)}MB). Maximum: 10MB. Use get-file for metadata or export-file for conversion.`,
    };
  }

  const content = await drive.files.get(
    { fileId: params.fileId, alt: "media", supportsAllDrives: true },
    { responseType: "text" },
  );

  return {
    id: meta.data.id,
    name: meta.data.name,
    mimeType: fileMimeType,
    content: content.data,
  };
}

// ── create-file ─────────────────────────────────────────────────────────────

export const createFileSchema = z.object({
  name: z.string().describe("Name of the file to create"),
  content: z.string().optional().describe("Text content of the file"),
  mimeType: z
    .string()
    .optional()
    .default("text/plain")
    .describe("MIME type. Use 'application/vnd.google-apps.{document|spreadsheet|presentation}' for Google native"),
  parentId: z
    .string()
    .optional()
    .default("root")
    .describe("Parent folder ID. Default: 'root'"),
});

export async function createFile(params: z.infer<typeof createFileSchema>) {
  assertWriteAllowed();
  const drive = getDriveClient();

  const requestBody: Record<string, unknown> = {
    name: params.name,
    parents: [params.parentId],
  };

  // For Google native types, set the mimeType on metadata
  if (params.mimeType.startsWith("application/vnd.google-apps.")) {
    requestBody.mimeType = params.mimeType;
  }

  const response = await drive.files.create({
    requestBody,
    media: params.content
      ? {
          mimeType: params.mimeType.startsWith("application/vnd.google-apps.")
            ? "text/plain"
            : params.mimeType,
          body: params.content,
        }
      : undefined,
    fields: FILE_FIELDS,
    supportsAllDrives: true,
  });

  return response.data;
}

// ── update-file ─────────────────────────────────────────────────────────────

export const updateFileSchema = z.object({
  fileId: z.string().describe("The ID of the file to update"),
  name: z.string().optional().describe("New name for the file"),
  content: z.string().optional().describe("New text content for the file"),
  mimeType: z
    .string()
    .optional()
    .describe("MIME type of the new content"),
});

export async function updateFile(params: z.infer<typeof updateFileSchema>) {
  assertWriteAllowed();
  const drive = getDriveClient();

  const requestBody: Record<string, unknown> = {};
  if (params.name) requestBody.name = params.name;

  const response = await drive.files.update({
    fileId: params.fileId,
    requestBody,
    media: params.content
      ? {
          mimeType: params.mimeType ?? "text/plain",
          body: params.content,
        }
      : undefined,
    fields: FILE_FIELDS,
    supportsAllDrives: true,
  });

  return response.data;
}

// ── copy-file ───────────────────────────────────────────────────────────────

export const copyFileSchema = z.object({
  fileId: z.string().describe("The ID of the file to copy"),
  name: z
    .string()
    .optional()
    .describe("Name for the copy. Default: 'Copy of <original>'"),
  parentId: z
    .string()
    .optional()
    .describe("Parent folder ID for the copy. Default: same parent as original"),
});

export async function copyFile(params: z.infer<typeof copyFileSchema>) {
  assertWriteAllowed();
  const drive = getDriveClient();

  const requestBody: Record<string, unknown> = {};
  if (params.name) requestBody.name = params.name;
  if (params.parentId) requestBody.parents = [params.parentId];

  const response = await drive.files.copy({
    fileId: params.fileId,
    requestBody,
    fields: FILE_FIELDS,
    supportsAllDrives: true,
  });

  return response.data;
}

// ── delete-file ─────────────────────────────────────────────────────────────

export const deleteFileSchema = z.object({
  fileId: z.string().describe("The ID of the file to delete"),
  permanent: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, permanently delete (skip trash)"),
});

export async function deleteFile(params: z.infer<typeof deleteFileSchema>) {
  assertWriteAllowed();
  const drive = getDriveClient();

  if (params.permanent) {
    await drive.files.delete({
      fileId: params.fileId,
      supportsAllDrives: true,
    });
    return { deleted: true, fileId: params.fileId, permanent: true };
  }

  const response = await drive.files.update({
    fileId: params.fileId,
    requestBody: { trashed: true },
    fields: FILE_FIELDS,
    supportsAllDrives: true,
  });

  return { trashed: true, file: response.data };
}
