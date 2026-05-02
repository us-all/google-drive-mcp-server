import { z } from "zod";
import { getDocsClient, getDriveClient } from "../client.js";
import { assertWriteAllowed } from "./utils.js";
import { applyExtractFields, extractFieldsDescription } from "./extract-fields.js";

const ef = z.string().optional().describe(extractFieldsDescription);

// ── Helpers ────────────────────────────────────────────────────────────────

/** Execute a documents.batchUpdate with one or more requests */
async function batchUpdateDocument(
  documentId: string,
  requests: Record<string, unknown>[],
) {
  const docs = getDocsClient();
  const response = await docs.documents.batchUpdate({
    documentId,
    requestBody: { requests },
  });
  return response.data.replies ?? [];
}

/** Convert hex color (#RRGGBB) to Docs API Color (0-1 floats) */
function hexToDocsColor(hex: string): { red: number; green: number; blue: number } {
  const h = hex.replace("#", "");
  return {
    red: parseInt(h.substring(0, 2), 16) / 255,
    green: parseInt(h.substring(2, 4), 16) / 255,
    blue: parseInt(h.substring(4, 6), 16) / 255,
  };
}

interface TextRun {
  content?: string;
  textStyle?: Record<string, unknown>;
}

interface ParagraphElement {
  startIndex?: number;
  endIndex?: number;
  textRun?: TextRun;
}

interface Paragraph {
  elements?: ParagraphElement[];
  paragraphStyle?: Record<string, unknown>;
}

interface StructuralElement {
  startIndex?: number;
  endIndex?: number;
  paragraph?: Paragraph;
  table?: Record<string, unknown>;
  sectionBreak?: Record<string, unknown>;
  tableOfContents?: Record<string, unknown>;
}

interface Body {
  content?: StructuralElement[];
}

interface TabProperties {
  tabId?: string;
  title?: string;
  parentTabId?: string;
  index?: number;
  nestingLevel?: number;
}

interface DocumentTab {
  body?: Body;
}

interface Tab {
  tabProperties?: TabProperties;
  documentTab?: DocumentTab;
  childTabs?: Tab[];
}

/** Extract plain text from a document body */
function extractPlainText(body: Body): string {
  const parts: string[] = [];
  for (const element of body.content ?? []) {
    if (element.paragraph?.elements) {
      for (const el of element.paragraph.elements) {
        if (el.textRun?.content) {
          parts.push(el.textRun.content);
        }
      }
    }
  }
  return parts.join("");
}

/** Flatten tabs recursively */
function flattenTabs(tabs: Tab[]): Tab[] {
  const result: Tab[] = [];
  for (const tab of tabs) {
    result.push(tab);
    if (tab.childTabs?.length) {
      result.push(...flattenTabs(tab.childTabs));
    }
  }
  return result;
}

/** Find a tab's body by tabId */
function findTabBody(tabs: Tab[], tabId: string): Body | null {
  const allTabs = flattenTabs(tabs);
  const found = allTabs.find((t) => t.tabProperties?.tabId === tabId);
  return found?.documentTab?.body ?? null;
}

/** Build a Location object with optional tabId */
function makeLocation(
  index: number | undefined,
  segmentId: string | undefined,
  tabId: string | undefined,
  endOfSegment: boolean,
): Record<string, unknown> {
  if (endOfSegment) {
    const loc: Record<string, unknown> = { endOfSegmentLocation: {} };
    if (segmentId) (loc.endOfSegmentLocation as Record<string, unknown>).segmentId = segmentId;
    if (tabId) (loc.endOfSegmentLocation as Record<string, unknown>).tabId = tabId;
    return loc;
  }
  const loc: Record<string, unknown> = { location: { index: index ?? 1 } };
  if (segmentId) (loc.location as Record<string, unknown>).segmentId = segmentId;
  if (tabId) (loc.location as Record<string, unknown>).tabId = tabId;
  return loc;
}

/** Build a Range object */
function makeRange(
  startIndex: number,
  endIndex: number,
  segmentId?: string,
  tabId?: string,
): Record<string, unknown> {
  const range: Record<string, unknown> = { startIndex, endIndex };
  if (segmentId) range.segmentId = segmentId;
  if (tabId) range.tabId = tabId;
  return range;
}

// ── docs-get-document ──────────────────────────────────────────────────────

export const docsGetDocumentSchema = z.object({
  documentId: z.string().describe("The ID of the Google Docs document"),
  extractFields: ef,
});

const GET_DOCUMENT_DEFAULT_FIELDS = "documentId,title,revisionId";

export async function docsGetDocument(
  params: z.infer<typeof docsGetDocumentSchema>,
) {
  const docs = getDocsClient();
  const response = await docs.documents.get({
    documentId: params.documentId,
    includeTabsContent: true,
  });

  const d = response.data;
  const allTabs = flattenTabs((d.tabs ?? []) as Tab[]);

  const result = {
    documentId: d.documentId,
    title: d.title,
    revisionId: d.revisionId,
    tabsCount: allTabs.length,
    tabs: allTabs.map((t) => ({
      tabId: t.tabProperties?.tabId,
      title: t.tabProperties?.title,
      index: t.tabProperties?.index,
      nestingLevel: t.tabProperties?.nestingLevel,
      parentTabId: t.tabProperties?.parentTabId,
    })),
  };

  return applyExtractFields(result, params.extractFields ?? GET_DOCUMENT_DEFAULT_FIELDS);
}

// ── docs-create-document ───────────────────────────────────────────────────

export const docsCreateDocumentSchema = z.object({
  title: z.string().describe("Title of the new document"),
  parentFolderId: z
    .string()
    .optional()
    .describe("Drive folder ID to create the document in. Default: root"),
});

export async function docsCreateDocument(
  params: z.infer<typeof docsCreateDocumentSchema>,
) {
  assertWriteAllowed();
  const docs = getDocsClient();

  const response = await docs.documents.create({
    requestBody: { title: params.title },
  });

  const documentId = response.data.documentId!;

  if (params.parentFolderId) {
    const drive = getDriveClient();
    await drive.files.update({
      fileId: documentId,
      addParents: params.parentFolderId,
      removeParents: "root",
      supportsAllDrives: true,
    });
  }

  return {
    documentId,
    title: response.data.title,
  };
}

// ── docs-get-content ───────────────────────────────────────────────────────

export const docsGetContentSchema = z.object({
  documentId: z.string().describe("The ID of the Google Docs document"),
  tabId: z
    .string()
    .optional()
    .describe("Tab ID to read. If omitted, reads the first (default) tab"),
  format: z
    .enum(["structured", "plaintext"])
    .default("plaintext")
    .describe("'plaintext' for text; 'structured' for raw body.content"),
});

export async function docsGetContent(
  params: z.infer<typeof docsGetContentSchema>,
) {
  const docs = getDocsClient();
  const response = await docs.documents.get({
    documentId: params.documentId,
    includeTabsContent: true,
  });

  const d = response.data;
  let body: Body | null = null;

  if (params.tabId) {
    body = findTabBody((d.tabs ?? []) as Tab[], params.tabId);
    if (!body) {
      throw new Error(`Tab '${params.tabId}' not found in document`);
    }
  } else {
    // Default: first tab
    const tabs = (d.tabs ?? []) as Tab[];
    body = tabs[0]?.documentTab?.body ?? (d.body as Body | undefined) ?? null;
  }

  if (!body) {
    return { documentId: d.documentId, title: d.title, content: "" };
  }

  if (params.format === "plaintext") {
    return {
      documentId: d.documentId,
      title: d.title,
      content: extractPlainText(body),
    };
  }

  return {
    documentId: d.documentId,
    title: d.title,
    content: body.content,
  };
}

// ── docs-insert-text ───────────────────────────────────────────────────────

export const docsInsertTextSchema = z.object({
  documentId: z.string().describe("The ID of the Google Docs document"),
  text: z.string().describe("The text to insert"),
  index: z.coerce
    .number()
    .optional()
    .describe("The character index to insert at (1-based). Required unless endOfSegment is true"),
  segmentId: z.string().optional().describe("Segment ID (e.g., header or footer ID). Omit for body"),
  tabId: z.string().optional().describe("Tab ID for multi-tab documents"),
  endOfSegment: z
    .boolean()
    .default(false)
    .describe("If true, appends text at the end of the segment instead of using index"),
});

export async function docsInsertText(
  params: z.infer<typeof docsInsertTextSchema>,
) {
  assertWriteAllowed();

  const loc = makeLocation(params.index, params.segmentId, params.tabId, params.endOfSegment);
  const request: Record<string, unknown> = {
    insertText: { text: params.text, ...loc },
  };

  const replies = await batchUpdateDocument(params.documentId, [request]);
  return { documentId: params.documentId, inserted: true, replies };
}

// ── docs-delete-range ──────────────────────────────────────────────────────

export const docsDeleteRangeSchema = z.object({
  documentId: z.string().describe("The ID of the Google Docs document"),
  startIndex: z.coerce.number().describe("Start character index (inclusive, 1-based)"),
  endIndex: z.coerce.number().describe("End character index (exclusive)"),
  segmentId: z.string().optional().describe("Segment ID. Omit for body"),
  tabId: z.string().optional().describe("Tab ID for multi-tab documents"),
});

export async function docsDeleteRange(
  params: z.infer<typeof docsDeleteRangeSchema>,
) {
  assertWriteAllowed();

  const range = makeRange(params.startIndex, params.endIndex, params.segmentId, params.tabId);
  const request: Record<string, unknown> = {
    deleteContentRange: { range },
  };

  const replies = await batchUpdateDocument(params.documentId, [request]);
  return { documentId: params.documentId, deleted: true, replies };
}

// ── docs-replace-text ──────────────────────────────────────────────────────

export const docsReplaceTextSchema = z.object({
  documentId: z.string().describe("The ID of the Google Docs document"),
  findText: z.string().describe("The text to search for"),
  replaceText: z.string().describe("The text to replace with"),
  matchCase: z.boolean().default(false).describe("Whether to match case exactly"),
  tabIds: z
    .array(z.string())
    .optional()
    .describe("Restrict replacement to specific tab IDs. If omitted, replaces in all tabs"),
});

export async function docsReplaceText(
  params: z.infer<typeof docsReplaceTextSchema>,
) {
  assertWriteAllowed();

  const request: Record<string, unknown> = {
    replaceAllText: {
      containsText: {
        text: params.findText,
        matchCase: params.matchCase,
      },
      replaceText: params.replaceText,
    },
  };

  if (params.tabIds?.length) {
    (request.replaceAllText as Record<string, unknown>).tabsCriteria = {
      tabIds: params.tabIds,
    };
  }

  const replies = await batchUpdateDocument(params.documentId, [request]);
  return {
    documentId: params.documentId,
    occurrencesChanged: (replies[0] as Record<string, unknown>)?.replaceAllText ??
      replies[0] ?? null,
  };
}

// ── docs-batch-update ──────────────────────────────────────────────────────

export const docsBatchUpdateSchema = z.object({
  documentId: z.string().describe("The ID of the Google Docs document"),
  requests: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Docs API batchUpdate request objects"),
});

export async function docsBatchUpdate(
  params: z.infer<typeof docsBatchUpdateSchema>,
) {
  assertWriteAllowed();
  const replies = await batchUpdateDocument(params.documentId, params.requests);
  return { documentId: params.documentId, repliesCount: replies.length, replies };
}

// ── docs-format-text ───────────────────────────────────────────────────────

export const docsFormatTextSchema = z.object({
  documentId: z.string().describe("The ID of the Google Docs document"),
  startIndex: z.coerce.number().describe("Start character index (inclusive, 1-based)"),
  endIndex: z.coerce.number().describe("End character index (exclusive)"),
  segmentId: z.string().optional().describe("Segment ID. Omit for body"),
  tabId: z.string().optional().describe("Tab ID for multi-tab documents"),
  bold: z.boolean().optional().describe("Set bold"),
  italic: z.boolean().optional().describe("Set italic"),
  underline: z.boolean().optional().describe("Set underline"),
  strikethrough: z.boolean().optional().describe("Set strikethrough"),
  fontFamily: z.string().optional().describe("Font family name (e.g., 'Arial', 'Times New Roman')"),
  fontSize: z.coerce.number().optional().describe("Font size in points"),
  foregroundColor: z.string().optional().describe("Text color as hex (#RRGGBB)"),
  backgroundColor: z.string().optional().describe("Text background/highlight color as hex (#RRGGBB)"),
  link: z.string().optional().describe("URL to link the text to. Pass empty string to remove link"),
});

export async function docsFormatText(
  params: z.infer<typeof docsFormatTextSchema>,
) {
  assertWriteAllowed();

  const textStyle: Record<string, unknown> = {};
  const fields: string[] = [];

  if (params.bold !== undefined) { textStyle.bold = params.bold; fields.push("bold"); }
  if (params.italic !== undefined) { textStyle.italic = params.italic; fields.push("italic"); }
  if (params.underline !== undefined) { textStyle.underline = params.underline; fields.push("underline"); }
  if (params.strikethrough !== undefined) { textStyle.strikethrough = params.strikethrough; fields.push("strikethrough"); }
  if (params.fontFamily) {
    textStyle.weightedFontFamily = { fontFamily: params.fontFamily };
    fields.push("weightedFontFamily");
  }
  if (params.fontSize !== undefined) {
    textStyle.fontSize = { magnitude: params.fontSize, unit: "PT" };
    fields.push("fontSize");
  }
  if (params.foregroundColor) {
    textStyle.foregroundColor = { color: { rgbColor: hexToDocsColor(params.foregroundColor) } };
    fields.push("foregroundColor");
  }
  if (params.backgroundColor) {
    textStyle.backgroundColor = { color: { rgbColor: hexToDocsColor(params.backgroundColor) } };
    fields.push("backgroundColor");
  }
  if (params.link !== undefined) {
    textStyle.link = params.link ? { url: params.link } : null;
    fields.push("link");
  }

  if (fields.length === 0) {
    return { documentId: params.documentId, message: "No formatting fields specified" };
  }

  const range = makeRange(params.startIndex, params.endIndex, params.segmentId, params.tabId);
  const request: Record<string, unknown> = {
    updateTextStyle: {
      range,
      textStyle,
      fields: fields.join(","),
    },
  };

  const replies = await batchUpdateDocument(params.documentId, [request]);
  return { documentId: params.documentId, formatted: true, fields, replies };
}

// ── docs-format-paragraph ──────────────────────────────────────────────────

export const docsFormatParagraphSchema = z.object({
  documentId: z.string().describe("The ID of the Google Docs document"),
  startIndex: z.coerce.number().describe("Start character index (inclusive, 1-based)"),
  endIndex: z.coerce.number().describe("End character index (exclusive)"),
  segmentId: z.string().optional().describe("Segment ID. Omit for body"),
  tabId: z.string().optional().describe("Tab ID for multi-tab documents"),
  alignment: z
    .enum(["START", "CENTER", "END", "JUSTIFIED"])
    .optional()
    .describe("Paragraph alignment"),
  namedStyleType: z
    .enum(["NORMAL_TEXT", "TITLE", "SUBTITLE", "HEADING_1", "HEADING_2", "HEADING_3", "HEADING_4", "HEADING_5", "HEADING_6"])
    .optional()
    .describe("Named style to apply (e.g., HEADING_1, TITLE)"),
  lineSpacing: z.coerce.number().optional().describe("Line spacing as percentage (e.g., 100 for single, 200 for double)"),
  spaceAbove: z.coerce.number().optional().describe("Space above paragraph in points"),
  spaceBelow: z.coerce.number().optional().describe("Space below paragraph in points"),
  indentStart: z.coerce.number().optional().describe("Start (left) indent in points"),
  indentEnd: z.coerce.number().optional().describe("End (right) indent in points"),
  indentFirstLine: z.coerce.number().optional().describe("First line indent in points"),
});

export async function docsFormatParagraph(
  params: z.infer<typeof docsFormatParagraphSchema>,
) {
  assertWriteAllowed();

  const paragraphStyle: Record<string, unknown> = {};
  const fields: string[] = [];

  if (params.alignment) { paragraphStyle.alignment = params.alignment; fields.push("alignment"); }
  if (params.namedStyleType) { paragraphStyle.namedStyleType = params.namedStyleType; fields.push("namedStyleType"); }
  if (params.lineSpacing !== undefined) { paragraphStyle.lineSpacing = params.lineSpacing; fields.push("lineSpacing"); }
  if (params.spaceAbove !== undefined) {
    paragraphStyle.spaceAbove = { magnitude: params.spaceAbove, unit: "PT" };
    fields.push("spaceAbove");
  }
  if (params.spaceBelow !== undefined) {
    paragraphStyle.spaceBelow = { magnitude: params.spaceBelow, unit: "PT" };
    fields.push("spaceBelow");
  }
  if (params.indentStart !== undefined) {
    paragraphStyle.indentStart = { magnitude: params.indentStart, unit: "PT" };
    fields.push("indentStart");
  }
  if (params.indentEnd !== undefined) {
    paragraphStyle.indentEnd = { magnitude: params.indentEnd, unit: "PT" };
    fields.push("indentEnd");
  }
  if (params.indentFirstLine !== undefined) {
    paragraphStyle.indentFirstLine = { magnitude: params.indentFirstLine, unit: "PT" };
    fields.push("indentFirstLine");
  }

  if (fields.length === 0) {
    return { documentId: params.documentId, message: "No paragraph formatting fields specified" };
  }

  const range = makeRange(params.startIndex, params.endIndex, params.segmentId, params.tabId);
  const request: Record<string, unknown> = {
    updateParagraphStyle: {
      range,
      paragraphStyle,
      fields: fields.join(","),
    },
  };

  const replies = await batchUpdateDocument(params.documentId, [request]);
  return { documentId: params.documentId, formatted: true, fields, replies };
}

// ── docs-insert-table ──────────────────────────────────────────────────────

export const docsInsertTableSchema = z.object({
  documentId: z.string().describe("The ID of the Google Docs document"),
  rows: z.coerce.number().describe("Number of rows"),
  columns: z.coerce.number().describe("Number of columns"),
  index: z.coerce
    .number()
    .optional()
    .describe("Character index to insert at. Required unless endOfSegment is true"),
  segmentId: z.string().optional().describe("Segment ID. Omit for body"),
  endOfSegment: z
    .boolean()
    .default(false)
    .describe("If true, inserts at the end of the segment"),
});

export async function docsInsertTable(
  params: z.infer<typeof docsInsertTableSchema>,
) {
  assertWriteAllowed();

  const loc = makeLocation(params.index, params.segmentId, undefined, params.endOfSegment);
  const request: Record<string, unknown> = {
    insertTable: {
      rows: params.rows,
      columns: params.columns,
      ...loc,
    },
  };

  const replies = await batchUpdateDocument(params.documentId, [request]);
  return { documentId: params.documentId, inserted: true, rows: params.rows, columns: params.columns, replies };
}

// ── docs-insert-image ──────────────────────────────────────────────────────

export const docsInsertImageSchema = z.object({
  documentId: z.string().describe("The ID of the Google Docs document"),
  uri: z.string().describe("The image URL (must be publicly accessible or a Drive image URL)"),
  index: z.coerce
    .number()
    .optional()
    .describe("Character index to insert at. Required unless endOfSegment is true"),
  segmentId: z.string().optional().describe("Segment ID. Omit for body"),
  endOfSegment: z
    .boolean()
    .default(false)
    .describe("If true, inserts at the end of the segment"),
  width: z.coerce.number().optional().describe("Image width in points"),
  height: z.coerce.number().optional().describe("Image height in points"),
});

export async function docsInsertImage(
  params: z.infer<typeof docsInsertImageSchema>,
) {
  assertWriteAllowed();

  const loc = makeLocation(params.index, params.segmentId, undefined, params.endOfSegment);
  const insertInlineImage: Record<string, unknown> = {
    uri: params.uri,
    ...loc,
  };

  if (params.width || params.height) {
    const objectSize: Record<string, unknown> = {};
    if (params.width) objectSize.width = { magnitude: params.width, unit: "PT" };
    if (params.height) objectSize.height = { magnitude: params.height, unit: "PT" };
    insertInlineImage.objectSize = objectSize;
  }

  const request: Record<string, unknown> = { insertInlineImage };

  const replies = await batchUpdateDocument(params.documentId, [request]);
  return { documentId: params.documentId, inserted: true, replies };
}

// ── docs-insert-page-break ─────────────────────────────────────────────────

export const docsInsertPageBreakSchema = z.object({
  documentId: z.string().describe("The ID of the Google Docs document"),
  index: z.coerce
    .number()
    .optional()
    .describe("Character index to insert at. Required unless endOfSegment is true"),
  segmentId: z.string().optional().describe("Segment ID. Omit for body"),
  endOfSegment: z
    .boolean()
    .default(false)
    .describe("If true, inserts at the end of the segment"),
});

export async function docsInsertPageBreak(
  params: z.infer<typeof docsInsertPageBreakSchema>,
) {
  assertWriteAllowed();

  const loc = makeLocation(params.index, params.segmentId, undefined, params.endOfSegment);
  const request: Record<string, unknown> = {
    insertPageBreak: { ...loc },
  };

  const replies = await batchUpdateDocument(params.documentId, [request]);
  return { documentId: params.documentId, inserted: true, replies };
}

// ── docs-list-tabs ─────────────────────────────────────────────────────────

export const docsListTabsSchema = z.object({
  documentId: z.string().describe("The ID of the Google Docs document"),
});

export async function docsListTabs(
  params: z.infer<typeof docsListTabsSchema>,
) {
  const docs = getDocsClient();
  const response = await docs.documents.get({
    documentId: params.documentId,
    includeTabsContent: false,
  });

  const allTabs = flattenTabs((response.data.tabs ?? []) as Tab[]);

  return {
    documentId: response.data.documentId,
    title: response.data.title,
    tabsCount: allTabs.length,
    tabs: allTabs.map((t) => ({
      tabId: t.tabProperties?.tabId,
      title: t.tabProperties?.title,
      index: t.tabProperties?.index,
      nestingLevel: t.tabProperties?.nestingLevel,
      parentTabId: t.tabProperties?.parentTabId,
    })),
  };
}
