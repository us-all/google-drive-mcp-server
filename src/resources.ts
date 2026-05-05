import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDriveClient, getSheetsClient, getDocsClient, getSlidesClient } from "./client.js";
import { getCapabilities } from "./capabilities.js";
import { requireGWS } from "./tools/utils.js";

const UI_DIR = join(dirname(fileURLToPath(import.meta.url)), "ui");
const AUDIT_SHARED_DRIVE_HTML = readFileSync(join(UI_DIR, "audit-shared-drive-permissions.html"), "utf-8");

/**
 * MCP Resources for hot Google Drive entities.
 * URI scheme: `gdrive://`
 *   - gdrive://file/{fileId}                 — Drive file metadata
 *   - gdrive://spreadsheet/{spreadsheetId}   — Sheets metadata
 *   - gdrive://document/{documentId}         — Docs metadata
 *   - gdrive://presentation/{presentationId} — Slides metadata
 *   - gdrive://shared-drive/{driveId}        — Shared Drive metadata + file count (GWS only)
 *   - gdrive://about/me                      — Current user's about info (storage, capabilities)
 */

function asJson(uri: string, data: unknown) {
  return {
    contents: [{
      uri,
      mimeType: "application/json",
      text: JSON.stringify(data, null, 2),
    }],
  };
}

const FILE_FIELDS =
  "id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,owners,shared,description,starred,properties,capabilities";

export function registerResources(server: McpServer): void {
  server.registerResource(
    "file",
    new ResourceTemplate("gdrive://file/{fileId}", { list: undefined }),
    {
      title: "Google Drive File",
      description: "Drive file metadata by ID",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const drive = getDriveClient();
      const r = await drive.files.get({
        fileId: String(vars.fileId),
        fields: FILE_FIELDS,
        supportsAllDrives: true,
      });
      return asJson(uri.toString(), r.data);
    },
  );

  server.registerResource(
    "spreadsheet",
    new ResourceTemplate("gdrive://spreadsheet/{spreadsheetId}", { list: undefined }),
    {
      title: "Google Sheets Spreadsheet",
      description: "Spreadsheet metadata + sheet list (no cell data)",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const sheets = getSheetsClient();
      const r = await sheets.spreadsheets.get({
        spreadsheetId: String(vars.spreadsheetId),
        fields: "spreadsheetId,properties(title,locale,timeZone),spreadsheetUrl,sheets(properties(sheetId,title,index,sheetType,gridProperties))",
      });
      return asJson(uri.toString(), r.data);
    },
  );

  server.registerResource(
    "document",
    new ResourceTemplate("gdrive://document/{documentId}", { list: undefined }),
    {
      title: "Google Docs Document",
      description: "Document metadata + body structure",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const docs = getDocsClient();
      const r = await docs.documents.get({
        documentId: String(vars.documentId),
        includeTabsContent: true,
      });
      return asJson(uri.toString(), r.data);
    },
  );

  server.registerResource(
    "presentation",
    new ResourceTemplate("gdrive://presentation/{presentationId}", { list: undefined }),
    {
      title: "Google Slides Presentation",
      description: "Presentation metadata + slide list",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const slides = getSlidesClient();
      const r = await slides.presentations.get({
        presentationId: String(vars.presentationId),
      });
      return asJson(uri.toString(), r.data);
    },
  );

  server.registerResource(
    "shared-drive",
    new ResourceTemplate("gdrive://shared-drive/{driveId}", { list: undefined }),
    {
      title: "Google Shared Drive",
      description: "Shared Drive metadata + immediate file count summary (GWS only)",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const caps = getCapabilities();
      if (caps) requireGWS(caps, "Shared Drives");

      const drive = getDriveClient();
      const driveId = String(vars.driveId);

      const driveMeta = await drive.drives.get({
        driveId,
        fields:
          "id,name,createdTime,hidden,restrictions,capabilities,backgroundImageLink,colorRgb",
      });

      // Count immediate (non-recursive) files in the Shared Drive root.
      const filesList = await drive.files.list({
        corpora: "drive",
        driveId,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        q: `'${driveId}' in parents and trashed = false`,
        fields: "files(id,mimeType),nextPageToken",
        pageSize: 1000,
      });

      const files = filesList.data.files ?? [];
      const folderCount = files.filter(
        (f) => f.mimeType === "application/vnd.google-apps.folder",
      ).length;
      const fileCount = files.length - folderCount;

      return asJson(uri.toString(), {
        ...driveMeta.data,
        summary: {
          immediateFileCount: fileCount,
          immediateFolderCount: folderCount,
          immediateTotal: files.length,
          truncated: Boolean(filesList.data.nextPageToken),
        },
      });
    },
  );

  server.registerResource(
    "about-me",
    "gdrive://about/me",
    {
      title: "Current User About Info",
      description:
        "Current user's about info — storage quota, capabilities, max upload size, account type",
      mimeType: "application/json",
    },
    async (uri) => {
      const drive = getDriveClient();
      const r = await drive.about.get({
        fields:
          "user(displayName,emailAddress,photoLink),storageQuota(limit,usage,usageInDrive,usageInDriveTrash),canCreateDrives,maxUploadSize,appInstalled,importFormats,exportFormats,folderColorPalette",
      });

      const caps = getCapabilities();

      return asJson(uri.toString(), {
        ...r.data,
        accountType: caps?.isGWS ? "Google Workspace" : "Personal",
        domain: caps?.domain,
        gwsCapabilities: caps
          ? {
              sharedDrives: caps.sharedDrives,
              labels: caps.labels,
              contentRestrictions: caps.contentRestrictions,
              driveActivity: caps.driveActivity,
            }
          : null,
      });
    },
  );

  // --- Apps SDK UI templates (ui:// scheme) ---
  // Rendered by ChatGPT / Apps SDK clients via _meta["openai/outputTemplate"].
  // Claude clients ignore the metadata and use the tool's text content instead.
  server.registerResource(
    "audit-shared-drive-permissions-card",
    "ui://widget/audit-shared-drive-permissions.html",
    {
      title: "Shared Drive Permission Audit card",
      description: "Apps SDK UI template rendered with audit-shared-drive-permissions tool output",
      mimeType: "text/html+skybridge",
      _meta: {
        "openai/outputTemplate": "ui://widget/audit-shared-drive-permissions.html",
        "ui.resourceUri": "ui://widget/audit-shared-drive-permissions.html",
      },
    },
    async (uri) => ({
      contents: [{
        uri: uri.toString(),
        mimeType: "text/html+skybridge",
        text: AUDIT_SHARED_DRIVE_HTML,
      }],
    }),
  );
}
