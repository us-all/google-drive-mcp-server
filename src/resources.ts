import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDriveClient, getSheetsClient, getDocsClient, getSlidesClient } from "./client.js";

/**
 * MCP Resources for hot Google Drive entities.
 * URI scheme: `gdrive://`
 *   - gdrive://file/{fileId}                 — Drive file metadata
 *   - gdrive://spreadsheet/{spreadsheetId}   — Sheets metadata
 *   - gdrive://document/{documentId}         — Docs metadata
 *   - gdrive://presentation/{presentationId} — Slides metadata
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
}
