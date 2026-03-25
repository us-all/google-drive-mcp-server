import { z } from "zod";
import { getDriveClient } from "../client.js";

// ── export-file ─────────────────────────────────────────────────────────────

export const exportFileSchema = z.object({
  fileId: z
    .string()
    .describe("The ID of the Google Docs/Sheets/Slides file to export"),
  mimeType: z
    .string()
    .describe(
      "Target MIME type. Google Docs: 'application/pdf', 'text/plain', 'text/html', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' (DOCX), 'text/markdown'. Google Sheets: 'text/csv', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' (XLSX). Google Slides: 'application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation' (PPTX)",
    ),
});

export async function exportFile(params: z.infer<typeof exportFileSchema>) {
  const drive = getDriveClient();

  const meta = await drive.files.get({
    fileId: params.fileId,
    fields: "id,name,mimeType",
    supportsAllDrives: true,
  });

  const exported = await drive.files.export({
    fileId: params.fileId,
    mimeType: params.mimeType,
  });

  return {
    id: meta.data.id,
    name: meta.data.name,
    sourceMimeType: meta.data.mimeType,
    exportedAs: params.mimeType,
    content: exported.data,
  };
}

// ── get-download-link ───────────────────────────────────────────────────────

export const getDownloadLinkSchema = z.object({
  fileId: z
    .string()
    .describe("The ID of the file to generate a download link for"),
});

export async function getDownloadLink(
  params: z.infer<typeof getDownloadLinkSchema>,
) {
  const drive = getDriveClient();

  const response = await drive.files.get({
    fileId: params.fileId,
    fields: "id,name,mimeType,size,webContentLink,webViewLink",
    supportsAllDrives: true,
  });

  return {
    id: response.data.id,
    name: response.data.name,
    mimeType: response.data.mimeType,
    size: response.data.size,
    downloadLink: response.data.webContentLink,
    viewLink: response.data.webViewLink,
  };
}
