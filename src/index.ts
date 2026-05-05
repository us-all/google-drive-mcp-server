#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startMcpServer } from "@us-all/mcp-toolkit/runtime";
import { validateConfig } from "./config.js";
import { detectCapabilities } from "./capabilities.js";
import { wrapToolHandler } from "./tools/utils.js";

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const { version: pkgVersion } = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };

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
  batchClearValuesSchema, batchClearValues,
  formatCellsSchema, formatCells,
  updateBordersSchema, updateBorders,
  mergeCellsSchema, mergeCells,
  unmergeCellsSchema, unmergeCells,
  sortRangeSchema, sortRange,
  findReplaceSchema, findReplace,
  insertDimensionSchema, insertDimension,
  deleteDimensionSchema, deleteDimension,
  copySheetToSchema, copySheetTo,
  duplicateSheetSchema, duplicateSheet,
  autoResizeSchema, autoResize,
  setDataValidationSchema, setDataValidation,
  addConditionalFormatSchema, addConditionalFormat,
  addChartSchema, addChart,
  deleteChartSchema, deleteChart,
  addProtectedRangeSchema, addProtectedRange,
  deleteProtectedRangeSchema, deleteProtectedRange,
  manageNamedRangeSchema, manageNamedRange,
  copyPasteSchema, copyPaste,
  resizeDimensionsSchema, resizeDimensions,
} from "./tools/sheets.js";

// Docs
import {
  docsGetDocumentSchema, docsGetDocument,
  docsCreateDocumentSchema, docsCreateDocument,
  docsGetContentSchema, docsGetContent,
  docsInsertTextSchema, docsInsertText,
  docsDeleteRangeSchema, docsDeleteRange,
  docsReplaceTextSchema, docsReplaceText,
  docsBatchUpdateSchema, docsBatchUpdate,
  docsFormatTextSchema, docsFormatText,
  docsFormatParagraphSchema, docsFormatParagraph,
  docsInsertTableSchema, docsInsertTable,
  docsInsertImageSchema, docsInsertImage,
  docsInsertPageBreakSchema, docsInsertPageBreak,
  docsListTabsSchema, docsListTabs,
} from "./tools/docs.js";

// Slides
import {
  getSlidesPresentationSchema, getSlidesPresentation,
  createPresentationSchema, createPresentation,
  duplicatePresentationSchema, duplicatePresentation,
  getSlideSchema, getSlide,
  addSlideSchema, addSlide,
  deleteSlideSchema, deleteSlide,
  moveSlideSchema, moveSlide,
  duplicateSlideSchema, duplicateSlide,
  insertTextSchema, insertText,
  replaceTextSchema, replaceAllText,
  insertTextBoxSchema, insertTextBox,
  insertImageSchema, insertImage,
  insertTableSchema, insertTable,
  updateTableCellSchema, updateTableCell,
  insertShapeSchema, insertShape,
  formatTextSchema, formatText,
  formatShapeSchema, formatShape,
  resizeElementSchema, resizeElement,
  setSlideBackgroundSchema, setSlideBackground,
  slidesBatchUpdateSchema, slidesBatchUpdate,
} from "./tools/slides.js";

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

import { registry, searchToolsSchema, searchTools, type Category } from "./tool-registry.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";
import {
  summarizeDocSchema,
  summarizeDoc,
  summarizeSpreadsheetSchema,
  summarizeSpreadsheet,
} from "./tools/aggregations.js";

const server = new McpServer({
  name: "google-drive",
  version: pkgVersion,
});

// --- Tool registration with category-based filtering (GD_TOOLS / GD_DISABLE) ---
let currentCategory: Category = "drive";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tool(name: string, description: string, schema: any, handler: any): void {
  registry.register(name, description, currentCategory);
  if (registry.isEnabled(currentCategory)) {
    server.tool(name, description, schema, handler);
  }
}

// ── Universal tools (personal + GWS) ───────────────────────────────────────
currentCategory = "drive";

// About
tool(
  "get-about",
  "Get Google Drive account information, storage quota, and detected capabilities (personal vs Google Workspace)",
  getAboutSchema.shape,
  wrapToolHandler(getAbout),
);

// Files
tool(
  "list-files",
  "List files and folders in a specific folder. Returns metadata including name, type, size, and modification time. Supports Shared Drives automatically",
  listFilesSchema.shape,
  wrapToolHandler(listFiles),
);

tool(
  "get-file",
  "Get detailed metadata for a specific file including description, properties, capabilities, and content restrictions",
  getFileSchema.shape,
  wrapToolHandler(getFile),
);

tool(
  "read-file",
  "Read the content of a file. Automatically exports Google Docs to Markdown, Sheets to CSV, Slides to plain text. For binary files, returns content up to 10MB",
  readFileSchema.shape,
  wrapToolHandler(readFile),
);

tool(
  "create-file",
  "Create a new file in Google Drive. Supports plain text, Google Docs, Sheets, and other formats. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  createFileSchema.shape,
  wrapToolHandler(createFile),
);

tool(
  "update-file",
  "Update an existing file's name and/or content. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  updateFileSchema.shape,
  wrapToolHandler(updateFile),
);

tool(
  "copy-file",
  "Create a copy of a file, optionally in a different folder with a new name. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  copyFileSchema.shape,
  wrapToolHandler(copyFile),
);

tool(
  "delete-file",
  "Move a file to trash or permanently delete it. Default: moves to trash. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  deleteFileSchema.shape,
  wrapToolHandler(deleteFile),
);

// Search
tool(
  "search-files",
  "Search files using Google Drive query syntax. Supports full-text search, name, MIME type, modification date, and more. Corpora: 'user' (default), 'domain', 'allDrives' (GWS)",
  searchFilesSchema.shape,
  wrapToolHandler(searchFiles),
);

// Folders
tool(
  "create-folder",
  "Create a new folder in Google Drive. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  createFolderSchema.shape,
  wrapToolHandler(createFolder),
);

tool(
  "move-file",
  "Move a file or folder to a different parent folder. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  moveFileSchema.shape,
  wrapToolHandler(moveFile),
);

tool(
  "get-folder-tree",
  "Get a hierarchical tree view of folders and files. Configurable depth (1-5). Useful for understanding Drive structure",
  getFolderTreeSchema.shape,
  wrapToolHandler(getFolderTree),
);

// Permissions
tool(
  "list-permissions",
  "List all sharing permissions for a file or folder. Shows who has access and their role",
  listPermissionsSchema.shape,
  wrapToolHandler(listPermissions),
);

tool(
  "share-file",
  "Share a file or folder with a user, group, domain, or anyone. Supports reader, commenter, writer, and organizer roles. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  shareFileSchema.shape,
  wrapToolHandler(shareFile),
);

tool(
  "remove-permission",
  "Remove a sharing permission from a file or folder. Use list-permissions to get the permission ID first. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  removePermissionSchema.shape,
  wrapToolHandler(removePermission),
);

// Export
tool(
  "export-file",
  "Export a Google Docs/Sheets/Slides file to a specific format (PDF, DOCX, CSV, XLSX, PPTX, HTML, Markdown, plain text)",
  exportFileSchema.shape,
  wrapToolHandler(exportFile),
);

tool(
  "get-download-link",
  "Get the direct download and web view links for a file",
  getDownloadLinkSchema.shape,
  wrapToolHandler(getDownloadLink),
);

// Comments
tool(
  "list-comments",
  "List comments on a file. Shows author, content, timestamps, and resolution status",
  listCommentsSchema.shape,
  wrapToolHandler(listComments),
);

tool(
  "get-comment",
  "Get a specific comment with full details including replies and quoted content",
  getCommentSchema.shape,
  wrapToolHandler(getComment),
);

tool(
  "create-comment",
  "Add a comment to a file. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  createCommentSchema.shape,
  wrapToolHandler(createComment),
);

tool(
  "resolve-comment",
  "Mark a comment as resolved. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  resolveCommentSchema.shape,
  wrapToolHandler(resolveComment),
);

// Revisions
tool(
  "list-revisions",
  "List revision history for a file. Shows who modified the file, when, and file size at each revision",
  listRevisionsSchema.shape,
  wrapToolHandler(listRevisions),
);

tool(
  "get-revision",
  "Get details of a specific file revision. Use 'head' for the latest revision",
  getRevisionSchema.shape,
  wrapToolHandler(getRevision),
);

// Activity
tool(
  "get-activity",
  "Get the activity history for a file or folder. Shows who viewed, edited, commented, or changed permissions. Works for both personal and GWS accounts",
  getActivitySchema.shape,
  wrapToolHandler(getActivity),
);

// ── Sheets tools ────────────────────────────────────────────────────────────
currentCategory = "sheets";

tool(
  "sheets-get-spreadsheet",
  "Get spreadsheet metadata — title, locale, and list of sheets (tabs) with their dimensions",
  getSpreadsheetSchema.shape,
  wrapToolHandler(getSpreadsheet),
);

tool(
  "sheets-get-values",
  "Read cell values from a range in A1 notation (e.g., 'Sheet1!A1:D10'). Supports formatted values, raw values, or formulas",
  getValuesSchema.shape,
  wrapToolHandler(getValues),
);

tool(
  "sheets-batch-get-values",
  "Read multiple ranges in a single request. More efficient than multiple get-values calls",
  batchGetValuesSchema.shape,
  wrapToolHandler(batchGetValues),
);

tool(
  "sheets-update-values",
  "Write values to a range. Values are parsed as if typed by a user (formulas, dates). Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  updateValuesSchema.shape,
  wrapToolHandler(updateValues),
);

tool(
  "sheets-batch-update-values",
  "Write to multiple ranges in one request. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  batchUpdateValuesSchema.shape,
  wrapToolHandler(batchUpdateValues),
);

tool(
  "sheets-append-values",
  "Append rows to the end of a table in a sheet. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  appendValuesSchema.shape,
  wrapToolHandler(appendValues),
);

tool(
  "sheets-create-spreadsheet",
  "Create a new spreadsheet with optional sheet names and target folder. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  createSpreadsheetSchema.shape,
  wrapToolHandler(createSpreadsheet),
);

tool(
  "sheets-manage-sheets",
  "Add, delete, or rename sheets (tabs) within a spreadsheet. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  manageSheetsSchema.shape,
  wrapToolHandler(manageSheets),
);

tool(
  "sheets-clear-values",
  "Clear all values from a range without removing formatting. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  clearValuesSchema.shape,
  wrapToolHandler(clearValues),
);

tool(
  "sheets-batch-clear-values",
  "Clear values from multiple ranges at once. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  batchClearValuesSchema.shape,
  wrapToolHandler(batchClearValues),
);

tool(
  "sheets-format-cells",
  "Format cells — bold, italic, font, colors, alignment, number format, wrap. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  formatCellsSchema.shape,
  wrapToolHandler(formatCells),
);

tool(
  "sheets-update-borders",
  "Set borders on a range — top, bottom, left, right, inner horizontal/vertical. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  updateBordersSchema.shape,
  wrapToolHandler(updateBorders),
);

tool(
  "sheets-merge-cells",
  "Merge cells in a range. Supports MERGE_ALL, MERGE_COLUMNS, MERGE_ROWS. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  mergeCellsSchema.shape,
  wrapToolHandler(mergeCells),
);

tool(
  "sheets-unmerge-cells",
  "Unmerge previously merged cells in a range. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  unmergeCellsSchema.shape,
  wrapToolHandler(unmergeCells),
);

tool(
  "sheets-sort-range",
  "Sort a range by one or more columns, ascending or descending. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  sortRangeSchema.shape,
  wrapToolHandler(sortRange),
);

tool(
  "sheets-find-replace",
  "Find and replace text across a sheet or entire spreadsheet. Supports regex. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  findReplaceSchema.shape,
  wrapToolHandler(findReplace),
);

tool(
  "sheets-insert-dimension",
  "Insert rows or columns at a specific position. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  insertDimensionSchema.shape,
  wrapToolHandler(insertDimension),
);

tool(
  "sheets-delete-dimension",
  "Delete rows or columns from a sheet. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  deleteDimensionSchema.shape,
  wrapToolHandler(deleteDimension),
);

tool(
  "sheets-copy-sheet-to",
  "Copy a sheet (tab) to another spreadsheet. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  copySheetToSchema.shape,
  wrapToolHandler(copySheetTo),
);

tool(
  "sheets-duplicate-sheet",
  "Duplicate a sheet within the same spreadsheet. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  duplicateSheetSchema.shape,
  wrapToolHandler(duplicateSheet),
);

tool(
  "sheets-auto-resize",
  "Auto-fit column widths or row heights to content. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  autoResizeSchema.shape,
  wrapToolHandler(autoResize),
);

tool(
  "sheets-set-data-validation",
  "Set data validation rules — dropdowns, number constraints, date rules, custom formulas. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  setDataValidationSchema.shape,
  wrapToolHandler(setDataValidation),
);

tool(
  "sheets-add-conditional-format",
  "Add conditional formatting — highlight rules or color gradient scales. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  addConditionalFormatSchema.shape,
  wrapToolHandler(addConditionalFormat),
);

tool(
  "sheets-add-chart",
  "Create an embedded chart (bar, line, area, column, scatter, combo). Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  addChartSchema.shape,
  wrapToolHandler(addChart),
);

tool(
  "sheets-delete-chart",
  "Delete an embedded chart by chart ID. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  deleteChartSchema.shape,
  wrapToolHandler(deleteChart),
);

tool(
  "sheets-add-protected-range",
  "Protect a range so only specific editors can modify it. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  addProtectedRangeSchema.shape,
  wrapToolHandler(addProtectedRange),
);

tool(
  "sheets-delete-protected-range",
  "Remove protection from a range. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  deleteProtectedRangeSchema.shape,
  wrapToolHandler(deleteProtectedRange),
);

tool(
  "sheets-manage-named-range",
  "Add, update, or delete named ranges. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  manageNamedRangeSchema.shape,
  wrapToolHandler(manageNamedRange),
);

tool(
  "sheets-copy-paste",
  "Copy and paste a range within or across sheets — supports paste values, format, formulas, transpose. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  copyPasteSchema.shape,
  wrapToolHandler(copyPaste),
);

tool(
  "sheets-resize-dimensions",
  "Set explicit row height or column width in pixels. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  resizeDimensionsSchema.shape,
  wrapToolHandler(resizeDimensions),
);

// ── Docs tools ──────────────────────────────────────────────────────────
currentCategory = "docs";

tool(
  "docs-get-document",
  "Get Google Docs document metadata including title, revision ID, and tabs summary",
  docsGetDocumentSchema.shape,
  wrapToolHandler(docsGetDocument),
);

tool(
  "docs-create-document",
  "Create a new Google Docs document, optionally in a specific folder. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  docsCreateDocumentSchema.shape,
  wrapToolHandler(docsCreateDocument),
);

tool(
  "docs-get-content",
  "Read document content as plain text or structured JSON with character indices. Supports multi-tab documents",
  docsGetContentSchema.shape,
  wrapToolHandler(docsGetContent),
);

tool(
  "docs-insert-text",
  "Insert text at a specific character index or at the end of a segment. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  docsInsertTextSchema.shape,
  wrapToolHandler(docsInsertText),
);

tool(
  "docs-delete-range",
  "Delete content within a character index range. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  docsDeleteRangeSchema.shape,
  wrapToolHandler(docsDeleteRange),
);

tool(
  "docs-replace-text",
  "Find and replace text throughout the document or in specific tabs. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  docsReplaceTextSchema.shape,
  wrapToolHandler(docsReplaceText),
);

tool(
  "docs-batch-update",
  "Execute raw Docs API batchUpdate requests for advanced operations not covered by other tools. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  docsBatchUpdateSchema.shape,
  wrapToolHandler(docsBatchUpdate),
);

tool(
  "docs-format-text",
  "Format text style — bold, italic, underline, strikethrough, font, size, color, background color, links. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  docsFormatTextSchema.shape,
  wrapToolHandler(docsFormatText),
);

tool(
  "docs-format-paragraph",
  "Format paragraph style — alignment, heading level, line spacing, indentation, spacing before/after. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  docsFormatParagraphSchema.shape,
  wrapToolHandler(docsFormatParagraph),
);

tool(
  "docs-insert-table",
  "Insert a table with specified rows and columns at a position. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  docsInsertTableSchema.shape,
  wrapToolHandler(docsInsertTable),
);

tool(
  "docs-insert-image",
  "Insert an inline image from a URL at a specific position. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  docsInsertImageSchema.shape,
  wrapToolHandler(docsInsertImage),
);

tool(
  "docs-insert-page-break",
  "Insert a page break at a specific position. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  docsInsertPageBreakSchema.shape,
  wrapToolHandler(docsInsertPageBreak),
);

tool(
  "docs-list-tabs",
  "List all tabs in a multi-tab document with their IDs, titles, and nesting structure",
  docsListTabsSchema.shape,
  wrapToolHandler(docsListTabs),
);

// ── Slides tools ─────────────────────────────────────────────────────────
currentCategory = "slides";

tool(
  "slides-get-presentation",
  "Get presentation metadata, slides list, and master/layout info",
  getSlidesPresentationSchema.shape,
  wrapToolHandler(getSlidesPresentation),
);

tool(
  "slides-create-presentation",
  "Create a new Google Slides presentation. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  createPresentationSchema.shape,
  wrapToolHandler(createPresentation),
);

tool(
  "slides-duplicate-presentation",
  "Duplicate a presentation via Drive copy. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  duplicatePresentationSchema.shape,
  wrapToolHandler(duplicatePresentation),
);

tool(
  "slides-get-slide",
  "Get details of a specific slide including all page elements, shapes, text, images, and tables",
  getSlideSchema.shape,
  wrapToolHandler(getSlide),
);

tool(
  "slides-add-slide",
  "Add a new slide with optional layout (predefined or by layoutId). Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  addSlideSchema.shape,
  wrapToolHandler(addSlide),
);

tool(
  "slides-delete-slide",
  "Delete a slide by objectId. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  deleteSlideSchema.shape,
  wrapToolHandler(deleteSlide),
);

tool(
  "slides-move-slide",
  "Reorder slides within a presentation. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  moveSlideSchema.shape,
  wrapToolHandler(moveSlide),
);

tool(
  "slides-duplicate-slide",
  "Duplicate an existing slide within the same presentation. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  duplicateSlideSchema.shape,
  wrapToolHandler(duplicateSlide),
);

tool(
  "slides-insert-text",
  "Insert text into an existing text box or shape by objectId. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  insertTextSchema.shape,
  wrapToolHandler(insertText),
);

tool(
  "slides-replace-text",
  "Find and replace text across the entire presentation or specific slides. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  replaceTextSchema.shape,
  wrapToolHandler(replaceAllText),
);

tool(
  "slides-insert-text-box",
  "Create a new text box with text, position, and size on a slide. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  insertTextBoxSchema.shape,
  wrapToolHandler(insertTextBox),
);

tool(
  "slides-insert-image",
  "Insert an image from a URL onto a slide with position and size. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  insertImageSchema.shape,
  wrapToolHandler(insertImage),
);

tool(
  "slides-insert-table",
  "Create a table with specified rows and columns on a slide. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  insertTableSchema.shape,
  wrapToolHandler(insertTable),
);

tool(
  "slides-update-table-cell",
  "Update text in a specific table cell by row and column index. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  updateTableCellSchema.shape,
  wrapToolHandler(updateTableCell),
);

tool(
  "slides-insert-shape",
  "Insert a shape (RECTANGLE, ELLIPSE, ROUND_RECTANGLE, STAR_5, ARROW_LEFT, etc.) onto a slide. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  insertShapeSchema.shape,
  wrapToolHandler(insertShape),
);

tool(
  "slides-format-text",
  "Format text style — bold, italic, underline, font family, font size, text color. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  formatTextSchema.shape,
  wrapToolHandler(formatText),
);

tool(
  "slides-format-shape",
  "Format shape fill color, border color, and border weight. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  formatShapeSchema.shape,
  wrapToolHandler(formatShape),
);

tool(
  "slides-resize-element",
  "Change an element's position and/or size on a slide. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  resizeElementSchema.shape,
  wrapToolHandler(resizeElement),
);

tool(
  "slides-set-slide-background",
  "Set a slide's background to a solid color. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  setSlideBackgroundSchema.shape,
  wrapToolHandler(setSlideBackground),
);

tool(
  "slides-batch-update",
  "Execute raw Slides API batchUpdate requests for advanced operations not covered by other tools. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  slidesBatchUpdateSchema.shape,
  wrapToolHandler(slidesBatchUpdate),
);

// ── GWS-only tools ──────────────────────────────────────────────────────────
currentCategory = "shared-drives";

// Shared Drives
tool(
  "list-shared-drives",
  "[GWS] List Shared Drives (Team Drives) accessible to the current user. Requires Google Workspace Business Standard or higher",
  listSharedDrivesSchema.shape,
  wrapToolHandler(listSharedDrives),
);

tool(
  "get-shared-drive",
  "[GWS] Get details of a specific Shared Drive including restrictions and capabilities",
  getSharedDriveSchema.shape,
  wrapToolHandler(getSharedDrive),
);

tool(
  "create-shared-drive",
  "[GWS] Create a new Shared Drive. Requires Google Workspace Business Standard or higher. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  createSharedDriveSchema.shape,
  wrapToolHandler(createSharedDrive),
);

// Labels
currentCategory = "labels";
tool(
  "list-file-labels",
  "[GWS] List classification labels applied to a file. Labels are structured metadata for compliance and governance. Requires Google Workspace Business Standard or higher",
  listFileLabelsSchema.shape,
  wrapToolHandler(listFileLabels),
);

tool(
  "apply-label",
  "[GWS] Apply a classification label to a file with optional field values. Requires Google Workspace Business Standard or higher. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  applyLabelSchema.shape,
  wrapToolHandler(applyLabel),
);

tool(
  "remove-label",
  "[GWS] Remove a classification label from a file. Requires Google Workspace Business Standard or higher. Requires GOOGLE_DRIVE_ALLOW_WRITE=true",
  removeLabelSchema.shape,
  wrapToolHandler(removeLabel),
);

// Approvals
currentCategory = "approvals";
tool(
  "list-approvals",
  "[GWS] List approval requests for a file. Shows approval status, reviewers, and decisions. Requires Google Workspace",
  listApprovalsSchema.shape,
  wrapToolHandler(listApprovals),
);

tool(
  "get-approval",
  "[GWS] Get details of a specific approval request including reviewer responses",
  getApprovalSchema.shape,
  wrapToolHandler(getApproval),
);

// ── Aggregation tools (round-trip elimination) ──────────────────────────────
currentCategory = "docs";

tool(
  "summarize-doc",
  "Aggregated document view: file metadata + extracted plain-text content + permissions + (opt) comments in a single call. Replaces 3-4 round-trips of get-file + docs-get-content + list-permissions + list-comments.",
  summarizeDocSchema.shape,
  wrapToolHandler(summarizeDoc),
);

currentCategory = "sheets";

tool(
  "summarize-spreadsheet",
  "Aggregated spreadsheet view: shape (title/locale/timeZone, all tabs with sheetId/title/rowCount/columnCount) + per-tab sample rows (A1:Z<sampleRowCount>, default 5) + named ranges. One call replaces sheets-get-spreadsheet + N × sheets-get-values + named range listing. Per-tab failures recorded in `caveats` (other tabs still return).",
  summarizeSpreadsheetSchema.shape,
  wrapToolHandler(summarizeSpreadsheet),
);

// ── Meta tools (always enabled) ──────────────────────────────────────────────
currentCategory = "meta";

tool(
  "search-tools",
  "Discover available tools by natural language query. Returns matching tool names + descriptions across all categories. Use this to navigate the tool surface efficiently — call this first, then call the specific tool you need.",
  searchToolsSchema.shape,
  wrapToolHandler(searchTools),
);

// ── MCP Resources (gdrive:// URI scheme) ────────────────────────────────────
registerResources(server);

// ── MCP Prompts (workflow templates) ────────────────────────────────────────
registerPrompts(server);

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

  await startMcpServer(server);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
