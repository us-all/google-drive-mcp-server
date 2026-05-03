import { z } from "zod";
import { aggregate } from "@us-all/mcp-toolkit";
import { getDriveClient, getDocsClient, getSheetsClient } from "../client.js";
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

  const caveats: string[] = [];

  const fetched = await aggregate(
    {
      meta: () =>
        drive.files.get({
          fileId: docId,
          fields: "id,name,mimeType,createdTime,modifiedTime,owners,size,webViewLink,description,starred",
          supportsAllDrives: true,
        }),
      doc: params.includeContent
        ? () => docs.documents.get({ documentId: docId, includeTabsContent: true })
        : () => Promise.resolve(null),
      perms: params.includePermissions
        ? () =>
            drive.permissions.list({
              fileId: docId,
              fields: "permissions(id,type,role,emailAddress,displayName)",
              supportsAllDrives: true,
            })
        : () => Promise.resolve(null),
      comments: params.includeComments
        ? () =>
            drive.comments.list({
              fileId: docId,
              fields: "comments(id,content,author,createdTime,resolved)",
              pageSize: 100,
            })
        : () => Promise.resolve(null),
    },
    caveats,
  );

  const meta = fetched.meta?.data ?? null;
  const doc = fetched.doc?.data ?? null;
  const perms = fetched.perms?.data ?? null;
  const comments = fetched.comments?.data ?? null;

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
    caveats,
  };
}

/**
 * `summarize-spreadsheet` — shape + per-tab sample in one call.
 * Replaces N+1 sequence: get-spreadsheet metadata → get-values per tab → list-named-ranges.
 */

export const summarizeSpreadsheetSchema = z.object({
  spreadsheetId: z.string().describe("Google Spreadsheet ID"),
  sampleRowCount: z.coerce
    .number()
    .int()
    .min(0)
    .max(50)
    .optional()
    .describe("Number of sample rows to fetch per sheet (0-50, default 5). 0 skips sample fetching."),
  includeNamedRanges: z
    .string()
    .optional()
    .describe('Include named ranges: "true" or "false" (default "true")'),
  extractFields: ef,
});

interface SheetProps {
  sheetId?: number | null;
  title?: string | null;
  gridProperties?: { rowCount?: number | null; columnCount?: number | null } | null;
}

interface SpreadsheetMeta {
  properties?: { title?: string | null; locale?: string | null; timeZone?: string | null } | null;
  sheets?: Array<{ properties?: SheetProps | null }> | null;
  namedRanges?: Array<{
    name?: string | null;
    namedRangeId?: string | null;
    range?: { sheetId?: number | null; startRowIndex?: number | null; endRowIndex?: number | null; startColumnIndex?: number | null; endColumnIndex?: number | null } | null;
  }> | null;
}

/** Convert zero-based column index → A1 letters (0 → "A", 25 → "Z", 26 → "AA"). */
function colIndexToLetters(idx: number): string {
  let n = idx;
  let out = "";
  while (n >= 0) {
    out = String.fromCharCode((n % 26) + 65) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

/** Build A1 range like 'Sheet1'!A1:Z5 — escape sheet title with single quotes (always safe). */
function buildSampleRange(sheetTitle: string, sampleRowCount: number): string {
  // Single-quote escape: replace ' with '' inside the title, then wrap.
  const escaped = sheetTitle.replace(/'/g, "''");
  return `'${escaped}'!A1:Z${sampleRowCount}`;
}

/** Format a NamedRange's GridRange as A1 notation (best-effort). */
function namedRangeToA1(nr: NonNullable<SpreadsheetMeta["namedRanges"]>[number]): string | null {
  const r = nr.range;
  if (!r) return null;
  const startRow = (r.startRowIndex ?? 0) + 1;
  const endRow = r.endRowIndex ?? startRow;
  const startCol = colIndexToLetters(r.startColumnIndex ?? 0);
  const endCol = colIndexToLetters((r.endColumnIndex ?? (r.startColumnIndex ?? 0) + 1) - 1);
  return `${startCol}${startRow}:${endCol}${endRow}`;
}

export async function summarizeSpreadsheet(
  params: z.infer<typeof summarizeSpreadsheetSchema>,
) {
  const sheets = getSheetsClient();
  const sampleRowCount = params.sampleRowCount ?? 5;
  const includeNamedRanges = (params.includeNamedRanges ?? "true").toLowerCase() !== "false";

  const caveats: string[] = [];

  // 1. Metadata (no grid data)
  const metaFields = [
    "spreadsheetId",
    "properties(title,locale,timeZone)",
    "sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))",
    includeNamedRanges
      ? "namedRanges(name,namedRangeId,range(sheetId,startRowIndex,endRowIndex,startColumnIndex,endColumnIndex))"
      : "",
  ]
    .filter(Boolean)
    .join(",");

  let meta: SpreadsheetMeta | null = null;
  try {
    const metaR = await sheets.spreadsheets.get({
      spreadsheetId: params.spreadsheetId,
      fields: metaFields,
    });
    meta = (metaR.data ?? null) as SpreadsheetMeta | null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    caveats.push(`metadata fetch failed: ${msg}`);
  }

  const sheetProps: SheetProps[] =
    (meta?.sheets ?? [])
      .map((s) => s?.properties)
      .filter((p): p is SheetProps => !!p);

  // 2. Per-sheet sample (skip if sampleRowCount === 0)
  type SampleResult = { sheetId: number | null | undefined; title: string | null | undefined; sample: unknown[][] | null };
  let sampleResults: SampleResult[] = sheetProps.map((p) => ({
    sheetId: p.sheetId ?? null,
    title: p.title ?? null,
    sample: null,
  }));

  if (sampleRowCount > 0 && sheetProps.length > 0) {
    const sampleFetches = sheetProps.map((p) => {
      if (!p.title) return Promise.resolve(null);
      return sheets.spreadsheets.values.get({
        spreadsheetId: params.spreadsheetId,
        range: buildSampleRange(p.title, sampleRowCount),
      });
    });
    const settled = await Promise.allSettled(sampleFetches);
    sampleResults = sheetProps.map((p, i) => {
      const r = settled[i];
      if (r.status === "fulfilled" && r.value) {
        return {
          sheetId: p.sheetId ?? null,
          title: p.title ?? null,
          sample: (r.value.data?.values ?? null) as unknown[][] | null,
        };
      }
      const msg = r.status === "rejected"
        ? r.reason instanceof Error ? r.reason.message : String(r.reason)
        : "no data";
      caveats.push(`sample fetch failed for sheet "${p.title ?? p.sheetId}": ${msg}`);
      return { sheetId: p.sheetId ?? null, title: p.title ?? null, sample: null };
    });
  }

  const sheetSummaries = sheetProps.map((p, i) => ({
    sheetId: p.sheetId ?? null,
    title: p.title ?? null,
    rowCount: p.gridProperties?.rowCount ?? null,
    columnCount: p.gridProperties?.columnCount ?? null,
    sample: sampleResults[i]?.sample ?? null,
  }));

  const namedRanges = includeNamedRanges
    ? (meta?.namedRanges ?? []).map((nr) => ({
        name: nr.name ?? null,
        rangeA1: namedRangeToA1(nr),
        sheetId: nr.range?.sheetId ?? null,
      }))
    : null;

  return {
    spreadsheetId: params.spreadsheetId,
    title: meta?.properties?.title ?? null,
    locale: meta?.properties?.locale ?? null,
    timeZone: meta?.properties?.timeZone ?? null,
    sheets: sheetSummaries,
    namedRanges,
    caveats,
  };
}
