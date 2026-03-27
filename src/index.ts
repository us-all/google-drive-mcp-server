#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { validateConfig } from "./config.js";
import { detectCapabilities } from "./capabilities.js";
import { wrapToolHandler } from "./tools/utils.js";

// ── Tool imports ────────────────────────────────────────────────────────────

// Files
import {
  listFilesSchema, listFiles,
  getFileSchema, getFile,
  readFileSchema, readFile,
  createFileSchema, createFile,
  updateFileSchema, updateFile,
  copyFileSchema, copyFile,
  deleteFileSchema, deleteFile,
} from "./tools/files.js";

// Search
import {
  searchFilesSchema, searchFiles,
} from "./tools/search.js";

// Folders
import {
  createFolderSchema, createFolder,
  moveFileSchema, moveFile,
  getFolderTreeSchema, getFolderTree,
} from "./tools/folders.js";

// Permissions
import {
  listPermissionsSchema, listPermissions,
  shareFileSchema, shareFile,
  removePermissionSchema, removePermission,
} from "./tools/permissions.js";

// Export
import {
  exportFileSchema, exportFile,
  getDownloadLinkSchema, getDownloadLink,
} from "./tools/export.js";

// Comments
import {
  listCommentsSchema, listComments,
  getCommentSchema, getComment,
  createCommentSchema, createComment,
  resolveCommentSchema, resolveComment,
} from "./tools/comments.js";

// Revisions
import {
  listRevisionsSchema, listRevisions,
  getRevisionSchema, getRevision,
} from "./tools/revisions.js";

// About
import { getAboutSchema, getAbout } from "./tools/about.js";

// Activity (available to all, but more useful for GWS)
import { getActivitySchema, getActivity } from "./tools/activity.js";

// Sheets
import {
  getSpreadsheetSchema, getSpreadsheet,
  getValuesSchema, getValues,
  batchGetValuesSchema, batchGetValues,
  updateValuesSchema, updateValues,
  batchUpdateValuesSchema, batchUpdateValues,
  appendValuesSchema, appendValues,
  createSpreadsheetSchema, createSpreadsheet,
  manageSheetsSchema, manageSheets,
  clearValuesSchema, clearValues,
} from "./tools/sheets.js";

// GWS-only: Shared Drives
import {
  listSharedDrivesSchema, listSharedDrives,
  getSharedDriveSchema, getSharedDrive,
  createSharedDriveSchema, createSharedDrive,
} from "./tools/shared-drives.js";

// GWS-only: Labels
import {
  listFileLabelsSchema, listFileLabels,
  applyLabelSchema, applyLabel,
  removeLabelSchema, removeLabel,
} from "./tools/labels.js";

// GWS-only: Approvals
import {
  listApprovalsSchema, listApprovals,
  getApprovalSchema, getApproval,
} from "./tools/approvals.js";

// ── Server setup ────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "google-drive",
  version: "1.1.0",
});

// ── Universal tools (personal + GWS) ───────────────────────────────────────

// About
server.tool(
  "get-about",
  "Get Google Drive account information, storage quota, and detected capabilities (personal vs Google Workspace)",
  getAboutSchema.shape,
  wrapToolHandler(getAbout),
);

// Files
server.tool(
  "list-files",
  "List files and folders in a specific folder. Returns metadata including name, type, size, and modification time. Supports Shared Drives automatically",
  listFilesSchema.shape,
  wrapToolHandler(listFiles),
);

server.tool(
  "get-file",
  "Get detailed metadata for a specific file including description, properties, capabilities, and content restrictions",
  getFileSchema.shape,
  wrapToolHandler(getFile),
);

server.tool(
  "read-file",
  "Read the content of a file. Automatically exports Google Docs to Markdown, Sheets to CSV, Slides to plain text. For binary files, returns content up to 10MB",
  readFileSchema.shape,
  wrapToolHandler(readFile),
);

server.tool(
  "create-file",
  "Create a new file in Google Drive. Supports plain text, Google Docs, Sheets, and other formats. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  createFileSchema.shape,
  wrapToolHandler(createFile),
);

server.tool(
  "update-file",
  "Update an existing file's name and/or content. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  updateFileSchema.shape,
  wrapToolHandler(updateFile),
);

server.tool(
  "copy-file",
  "Create a copy of a file, optionally in a different folder with a new name. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  copyFileSchema.shape,
  wrapToolHandler(copyFile),
);

server.tool(
  "delete-file",
  "Move a file to trash or permanently delete it. Default: moves to trash. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  deleteFileSchema.shape,
  wrapToolHandler(deleteFile),
);

// Search
server.tool(
  "search-files",
  "Search files using Google Drive query syntax. Supports full-text search, name, MIME type, modification date, and more. Corpora: 'user' (default), 'domain', 'allDrives' (GWS)",
  searchFilesSchema.shape,
  wrapToolHandler(searchFiles),
);

// Folders
server.tool(
  "create-folder",
  "Create a new folder in Google Drive. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  createFolderSchema.shape,
  wrapToolHandler(createFolder),
);

server.tool(
  "move-file",
  "Move a file or folder to a different parent folder. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  moveFileSchema.shape,
  wrapToolHandler(moveFile),
);

server.tool(
  "get-folder-tree",
  "Get a hierarchical tree view of folders and files. Configurable depth (1-5). Useful for understanding Drive structure",
  getFolderTreeSchema.shape,
  wrapToolHandler(getFolderTree),
);

// Permissions
server.tool(
  "list-permissions",
  "List all sharing permissions for a file or folder. Shows who has access and their role",
  listPermissionsSchema.shape,
  wrapToolHandler(listPermissions),
);

server.tool(
  "share-file",
  "Share a file or folder with a user, group, domain, or anyone. Supports reader, commenter, writer, and organizer roles. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  shareFileSchema.shape,
  wrapToolHandler(shareFile),
);

server.tool(
  "remove-permission",
  "Remove a sharing permission from a file or folder. Use list-permissions to get the permission ID first. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  removePermissionSchema.shape,
  wrapToolHandler(removePermission),
);

// Export
server.tool(
  "export-file",
  "Export a Google Docs/Sheets/Slides file to a specific format (PDF, DOCX, CSV, XLSX, PPTX, HTML, Markdown, plain text)",
  exportFileSchema.shape,
  wrapToolHandler(exportFile),
);

server.tool(
  "get-download-link",
  "Get the direct download and web view links for a file",
  getDownloadLinkSchema.shape,
  wrapToolHandler(getDownloadLink),
);

// Comments
server.tool(
  "list-comments",
  "List comments on a file. Shows author, content, timestamps, and resolution status",
  listCommentsSchema.shape,
  wrapToolHandler(listComments),
);

server.tool(
  "get-comment",
  "Get a specific comment with full details including replies and quoted content",
  getCommentSchema.shape,
  wrapToolHandler(getComment),
);

server.tool(
  "create-comment",
  "Add a comment to a file. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  createCommentSchema.shape,
  wrapToolHandler(createComment),
);

server.tool(
  "resolve-comment",
  "Mark a comment as resolved. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  resolveCommentSchema.shape,
  wrapToolHandler(resolveComment),
);

// Revisions
server.tool(
  "list-revisions",
  "List revision history for a file. Shows who modified the file, when, and file size at each revision",
  listRevisionsSchema.shape,
  wrapToolHandler(listRevisions),
);

server.tool(
  "get-revision",
  "Get details of a specific file revision. Use 'head' for the latest revision",
  getRevisionSchema.shape,
  wrapToolHandler(getRevision),
);

// Activity
server.tool(
  "get-activity",
  "Get the activity history for a file or folder. Shows who viewed, edited, commented, or changed permissions. Works for both personal and GWS accounts",
  getActivitySchema.shape,
  wrapToolHandler(getActivity),
);

// ── Sheets tools ────────────────────────────────────────────────────────────

server.tool(
  "sheets-get-spreadsheet",
  "Get spreadsheet metadata — title, locale, and list of sheets (tabs) with their dimensions",
  getSpreadsheetSchema.shape,
  wrapToolHandler(getSpreadsheet),
);

server.tool(
  "sheets-get-values",
  "Read cell values from a range in A1 notation (e.g., 'Sheet1!A1:D10'). Supports formatted values, raw values, or formulas",
  getValuesSchema.shape,
  wrapToolHandler(getValues),
);

server.tool(
  "sheets-batch-get-values",
  "Read multiple ranges in a single request. More efficient than multiple get-values calls",
  batchGetValuesSchema.shape,
  wrapToolHandler(batchGetValues),
);

server.tool(
  "sheets-update-values",
  "Write values to a range. Values are parsed as if typed by a user (formulas, dates). Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  updateValuesSchema.shape,
  wrapToolHandler(updateValues),
);

server.tool(
  "sheets-batch-update-values",
  "Write to multiple ranges in one request. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  batchUpdateValuesSchema.shape,
  wrapToolHandler(batchUpdateValues),
);

server.tool(
  "sheets-append-values",
  "Append rows to the end of a table in a sheet. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  appendValuesSchema.shape,
  wrapToolHandler(appendValues),
);

server.tool(
  "sheets-create-spreadsheet",
  "Create a new spreadsheet with optional sheet names and target folder. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  createSpreadsheetSchema.shape,
  wrapToolHandler(createSpreadsheet),
);

server.tool(
  "sheets-manage-sheets",
  "Add, delete, or rename sheets (tabs) within a spreadsheet. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  manageSheetsSchema.shape,
  wrapToolHandler(manageSheets),
);

server.tool(
  "sheets-clear-values",
  "Clear all values from a range without removing formatting. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  clearValuesSchema.shape,
  wrapToolHandler(clearValues),
);

// ── GWS-only tools ──────────────────────────────────────────────────────────

// Shared Drives
server.tool(
  "list-shared-drives",
  "[GWS] List Shared Drives (Team Drives) accessible to the current user. Requires Google Workspace Business Standard or higher",
  listSharedDrivesSchema.shape,
  wrapToolHandler(listSharedDrives),
);

server.tool(
  "get-shared-drive",
  "[GWS] Get details of a specific Shared Drive including restrictions and capabilities",
  getSharedDriveSchema.shape,
  wrapToolHandler(getSharedDrive),
);

server.tool(
  "create-shared-drive",
  "[GWS] Create a new Shared Drive. Requires Google Workspace Business Standard or higher. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  createSharedDriveSchema.shape,
  wrapToolHandler(createSharedDrive),
);

// Labels
server.tool(
  "list-file-labels",
  "[GWS] List classification labels applied to a file. Labels are structured metadata for compliance and governance. Requires Google Workspace Business Standard or higher",
  listFileLabelsSchema.shape,
  wrapToolHandler(listFileLabels),
);

server.tool(
  "apply-label",
  "[GWS] Apply a classification label to a file with optional field values. Requires Google Workspace Business Standard or higher. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  applyLabelSchema.shape,
  wrapToolHandler(applyLabel),
);

server.tool(
  "remove-label",
  "[GWS] Remove a classification label from a file. Requires Google Workspace Business Standard or higher. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  removeLabelSchema.shape,
  wrapToolHandler(removeLabel),
);

// Approvals
server.tool(
  "list-approvals",
  "[GWS] List approval requests for a file. Shows approval status, reviewers, and decisions. Requires Google Workspace",
  listApprovalsSchema.shape,
  wrapToolHandler(listApprovals),
);

server.tool(
  "get-approval",
  "[GWS] Get details of a specific approval request including reviewer responses",
  getApprovalSchema.shape,
  wrapToolHandler(getApproval),
);

// ── Start server ────────────────────────────────────────────────────────────

async function main() {
  validateConfig();

  // Detect account capabilities (personal vs GWS)
  try {
    const caps = await detectCapabilities();
    console.error(
      `Google Drive MCP server started — ${caps.isGWS ? `GWS (${caps.domain})` : "Personal"} account: ${caps.email}`,
    );
    if (caps.isGWS) {
      console.error(
        `  Shared Drives: ${caps.sharedDrives ? "available" : "not available"} | Labels: ${caps.labels ? "available" : "not available"}`,
      );
    }
  } catch (error) {
    console.error(
      "Google Drive MCP server started — capability detection deferred (will detect on first API call)",
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Drive MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
