import { z } from "zod";
import { getSheetsClient, getDriveClient } from "../client.js";
import { assertWriteAllowed } from "./utils.js";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Execute a spreadsheets.batchUpdate with one or more requests */
async function batchUpdateSpreadsheet(
  spreadsheetId: string,
  requests: Record<string, unknown>[],
) {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
  return response.data.replies ?? [];
}

/** Parse "A1" or "Sheet1!A1:B2" style range into GridRange components */
function parseGridRange(range: string, sheetId: number): Record<string, unknown> {
  // Strip sheet name if present
  const bangIdx = range.indexOf("!");
  const cellRange = bangIdx >= 0 ? range.substring(bangIdx + 1) : range;

  const parts = cellRange.split(":");
  const start = parseCellRef(parts[0]);
  const end = parts.length > 1 ? parseCellRef(parts[1]) : start;

  return {
    sheetId,
    startRowIndex: start.row,
    endRowIndex: end.row + 1,
    startColumnIndex: start.col,
    endColumnIndex: end.col + 1,
  };
}

function parseCellRef(ref: string): { row: number; col: number } {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error(`Invalid cell reference: ${ref}`);
  const col = match[1].split("").reduce((acc, c) => acc * 26 + c.charCodeAt(0) - 64, 0) - 1;
  const row = parseInt(match[2], 10) - 1;
  return { row, col };
}

/** Convert hex color (#RRGGBB) to Google Sheets Color object */
function hexToColor(hex: string): Record<string, number> {
  const h = hex.replace("#", "");
  return {
    red: parseInt(h.substring(0, 2), 16) / 255,
    green: parseInt(h.substring(2, 4), 16) / 255,
    blue: parseInt(h.substring(4, 6), 16) / 255,
  };
}

// ── sheets-get-spreadsheet ─────────────────────────────────────────────────

export const getSpreadsheetSchema = z.object({
  spreadsheetId: z.string().describe("The ID of the spreadsheet"),
  includeGridData: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to include cell data (can be very large). Default: false"),
});

export async function getSpreadsheet(
  params: z.infer<typeof getSpreadsheetSchema>,
) {
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.get({
    spreadsheetId: params.spreadsheetId,
    includeGridData: params.includeGridData,
    fields: params.includeGridData
      ? undefined
      : "spreadsheetId,properties(title,locale,timeZone),spreadsheetUrl,sheets(properties(sheetId,title,index,sheetType,gridProperties(rowCount,columnCount)))",
  });

  return {
    spreadsheetId: response.data.spreadsheetId,
    title: response.data.properties?.title,
    locale: response.data.properties?.locale,
    timeZone: response.data.properties?.timeZone,
    spreadsheetUrl: response.data.spreadsheetUrl,
    sheets: response.data.sheets?.map((s) => ({
      sheetId: s.properties?.sheetId,
      title: s.properties?.title,
      index: s.properties?.index,
      sheetType: s.properties?.sheetType,
      rowCount: s.properties?.gridProperties?.rowCount,
      columnCount: s.properties?.gridProperties?.columnCount,
    })),
  };
}

// ── sheets-get-values ──────────────────────────────────────────────────────

const valueRenderOption = z
  .enum(["FORMATTED_VALUE", "UNFORMATTED_VALUE", "FORMULA"])
  .optional()
  .default("FORMATTED_VALUE")
  .describe("How values should be rendered: FORMATTED_VALUE (default), UNFORMATTED_VALUE, or FORMULA");

const dateTimeRenderOption = z
  .enum(["FORMATTED_STRING", "SERIAL_NUMBER"])
  .optional()
  .default("FORMATTED_STRING")
  .describe("How dates should be rendered: FORMATTED_STRING (default) or SERIAL_NUMBER");

export const getValuesSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  range: z.string().describe("A1 notation range (e.g., 'Sheet1!A1:D10', 'A1:B5')"),
  valueRenderOption,
  dateTimeRenderOption,
});

export async function getValues(params: z.infer<typeof getValuesSchema>) {
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.spreadsheetId,
    range: params.range,
    valueRenderOption: params.valueRenderOption,
    dateTimeRenderOption: params.dateTimeRenderOption,
  });

  return {
    range: response.data.range,
    majorDimension: response.data.majorDimension,
    values: response.data.values ?? [],
  };
}

// ── sheets-batch-get-values ────────────────────────────────────────────────

export const batchGetValuesSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  ranges: z.array(z.string()).describe("Array of A1 notation ranges to read"),
  valueRenderOption,
  dateTimeRenderOption,
});

export async function batchGetValues(
  params: z.infer<typeof batchGetValuesSchema>,
) {
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: params.spreadsheetId,
    ranges: params.ranges,
    valueRenderOption: params.valueRenderOption,
    dateTimeRenderOption: params.dateTimeRenderOption,
  });

  return {
    spreadsheetId: response.data.spreadsheetId,
    valueRanges: response.data.valueRanges?.map((vr) => ({
      range: vr.range,
      majorDimension: vr.majorDimension,
      values: vr.values ?? [],
    })) ?? [],
  };
}

// ── sheets-update-values ───────────────────────────────────────────────────

const valueInputOption = z
  .enum(["RAW", "USER_ENTERED"])
  .optional()
  .default("USER_ENTERED")
  .describe("How input should be interpreted: USER_ENTERED (parses formulas/dates, default) or RAW");

export const updateValuesSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  range: z.string().describe("A1 notation range to write to (e.g., 'Sheet1!A1:C3')"),
  values: z.array(z.array(z.any())).describe("2D array of values to write"),
  valueInputOption,
});

export async function updateValues(
  params: z.infer<typeof updateValuesSchema>,
) {
  assertWriteAllowed();
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range: params.range,
    valueInputOption: params.valueInputOption,
    requestBody: {
      range: params.range,
      majorDimension: "ROWS",
      values: params.values,
    },
  });

  return {
    updatedRange: response.data.updatedRange,
    updatedRows: response.data.updatedRows,
    updatedColumns: response.data.updatedColumns,
    updatedCells: response.data.updatedCells,
  };
}

// ── sheets-batch-update-values ─────────────────────────────────────────────

export const batchUpdateValuesSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  data: z
    .array(
      z.object({
        range: z.string().describe("A1 notation range"),
        values: z.array(z.array(z.any())).describe("2D array of values"),
      }),
    )
    .describe("Array of range-value pairs to write"),
  valueInputOption,
});

export async function batchUpdateValues(
  params: z.infer<typeof batchUpdateValuesSchema>,
) {
  assertWriteAllowed();
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: params.spreadsheetId,
    requestBody: {
      valueInputOption: params.valueInputOption,
      data: params.data.map((d) => ({
        range: d.range,
        majorDimension: "ROWS" as const,
        values: d.values,
      })),
    },
  });

  return {
    totalUpdatedRows: response.data.totalUpdatedRows,
    totalUpdatedColumns: response.data.totalUpdatedColumns,
    totalUpdatedCells: response.data.totalUpdatedCells,
    totalUpdatedSheets: response.data.totalUpdatedSheets,
  };
}

// ── sheets-append-values ───────────────────────────────────────────────────

export const appendValuesSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  range: z
    .string()
    .describe("A1 notation range identifying the table to append to (e.g., 'Sheet1!A:E')"),
  values: z.array(z.array(z.any())).describe("Rows to append (2D array)"),
  valueInputOption,
  insertDataOption: z
    .enum(["OVERWRITE", "INSERT_ROWS"])
    .optional()
    .default("INSERT_ROWS")
    .describe("Whether to insert new rows or overwrite existing data after the table. Default: INSERT_ROWS"),
});

export async function appendValues(
  params: z.infer<typeof appendValuesSchema>,
) {
  assertWriteAllowed();
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: params.spreadsheetId,
    range: params.range,
    valueInputOption: params.valueInputOption,
    insertDataOption: params.insertDataOption,
    requestBody: {
      majorDimension: "ROWS",
      values: params.values,
    },
  });

  return {
    tableRange: response.data.tableRange,
    updatedRange: response.data.updates?.updatedRange,
    updatedRows: response.data.updates?.updatedRows,
    updatedColumns: response.data.updates?.updatedColumns,
    updatedCells: response.data.updates?.updatedCells,
  };
}

// ── sheets-create-spreadsheet ──────────────────────────────────────────────

export const createSpreadsheetSchema = z.object({
  title: z.string().describe("Title of the new spreadsheet"),
  sheetTitles: z
    .array(z.string())
    .optional()
    .describe("Names for initial sheets/tabs. Default: one sheet named 'Sheet1'"),
  parentFolderId: z
    .string()
    .optional()
    .describe("Drive folder ID to create the spreadsheet in. Default: root"),
});

export async function createSpreadsheet(
  params: z.infer<typeof createSpreadsheetSchema>,
) {
  assertWriteAllowed();
  const sheets = getSheetsClient();

  const requestBody: Record<string, unknown> = {
    properties: { title: params.title },
  };

  if (params.sheetTitles?.length) {
    requestBody.sheets = params.sheetTitles.map((title) => ({
      properties: { title },
    }));
  }

  const response = await sheets.spreadsheets.create({ requestBody });

  // Move to parent folder if specified
  if (params.parentFolderId && response.data.spreadsheetId) {
    const drive = getDriveClient();
    await drive.files.update({
      fileId: response.data.spreadsheetId,
      addParents: params.parentFolderId,
      removeParents: "root",
      supportsAllDrives: true,
    });
  }

  return {
    spreadsheetId: response.data.spreadsheetId,
    spreadsheetUrl: response.data.spreadsheetUrl,
    title: response.data.properties?.title,
    sheets: response.data.sheets?.map((s) => ({
      sheetId: s.properties?.sheetId,
      title: s.properties?.title,
    })),
  };
}

// ── sheets-manage-sheets ───────────────────────────────────────────────────

export const manageSheetsSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  action: z
    .enum(["add", "delete", "rename"])
    .describe("Action to perform: add, delete, or rename a sheet (tab)"),
  sheetId: z.coerce
    .number()
    .optional()
    .describe("Numeric sheet ID (required for delete and rename). Get from sheets-get-spreadsheet"),
  title: z
    .string()
    .optional()
    .describe("Sheet title (required for add and rename)"),
});

export async function manageSheets(
  params: z.infer<typeof manageSheetsSchema>,
) {
  assertWriteAllowed();

  let request: Record<string, unknown>;

  switch (params.action) {
    case "add":
      if (!params.title) throw new Error("title is required for 'add' action");
      request = { addSheet: { properties: { title: params.title } } };
      break;
    case "delete":
      if (params.sheetId === undefined) throw new Error("sheetId is required for 'delete' action");
      request = { deleteSheet: { sheetId: params.sheetId } };
      break;
    case "rename":
      if (params.sheetId === undefined) throw new Error("sheetId is required for 'rename' action");
      if (!params.title) throw new Error("title is required for 'rename' action");
      request = {
        updateSheetProperties: {
          properties: { sheetId: params.sheetId, title: params.title },
          fields: "title",
        },
      };
      break;
  }

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [request]);

  return {
    action: params.action,
    replies,
  };
}

// ── sheets-clear-values ────────────────────────────────────────────────────

export const clearValuesSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  range: z.string().describe("A1 notation range to clear (e.g., 'Sheet1!A1:D10')"),
});

export async function clearValues(
  params: z.infer<typeof clearValuesSchema>,
) {
  assertWriteAllowed();
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.clear({
    spreadsheetId: params.spreadsheetId,
    range: params.range,
  });

  return {
    clearedRange: response.data.clearedRange,
    spreadsheetId: response.data.spreadsheetId,
  };
}

// ── sheets-batch-clear-values ──────────────────────────────────────────────

export const batchClearValuesSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  ranges: z.array(z.string()).describe("Array of A1 notation ranges to clear"),
});

export async function batchClearValues(
  params: z.infer<typeof batchClearValuesSchema>,
) {
  assertWriteAllowed();
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.batchClear({
    spreadsheetId: params.spreadsheetId,
    requestBody: { ranges: params.ranges },
  });

  return {
    spreadsheetId: response.data.spreadsheetId,
    clearedRanges: response.data.clearedRanges ?? [],
  };
}

// ── sheets-format-cells ────────────────────────────────────────────────────

export const formatCellsSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID (from sheets-get-spreadsheet)"),
  range: z.string().describe("A1 notation range to format (e.g., 'A1:D10' or 'Sheet1!A1:D10')"),
  bold: z.boolean().optional().describe("Set bold"),
  italic: z.boolean().optional().describe("Set italic"),
  strikethrough: z.boolean().optional().describe("Set strikethrough"),
  fontSize: z.coerce.number().optional().describe("Font size in points"),
  fontFamily: z.string().optional().describe("Font family (e.g., 'Arial', 'Roboto')"),
  textColor: z.string().optional().describe("Text color as hex (e.g., '#FF0000')"),
  backgroundColor: z.string().optional().describe("Background color as hex (e.g., '#FFFF00')"),
  horizontalAlignment: z
    .enum(["LEFT", "CENTER", "RIGHT"])
    .optional()
    .describe("Horizontal alignment"),
  verticalAlignment: z
    .enum(["TOP", "MIDDLE", "BOTTOM"])
    .optional()
    .describe("Vertical alignment"),
  wrapStrategy: z
    .enum(["OVERFLOW_CELL", "CLIP", "WRAP"])
    .optional()
    .describe("Text wrapping strategy"),
  numberFormat: z
    .object({
      type: z.enum(["TEXT", "NUMBER", "PERCENT", "CURRENCY", "DATE", "TIME", "DATE_TIME", "SCIENTIFIC"]).describe("Format type"),
      pattern: z.string().optional().describe("Format pattern (e.g., '#,##0.00', 'yyyy-mm-dd')"),
    })
    .optional()
    .describe("Number/date format"),
});

export async function formatCells(
  params: z.infer<typeof formatCellsSchema>,
) {
  assertWriteAllowed();

  const cellFormat: Record<string, unknown> = {};
  const fields: string[] = [];

  // Text format
  const textFormat: Record<string, unknown> = {};
  if (params.bold !== undefined) { textFormat.bold = params.bold; fields.push("userEnteredFormat.textFormat.bold"); }
  if (params.italic !== undefined) { textFormat.italic = params.italic; fields.push("userEnteredFormat.textFormat.italic"); }
  if (params.strikethrough !== undefined) { textFormat.strikethrough = params.strikethrough; fields.push("userEnteredFormat.textFormat.strikethrough"); }
  if (params.fontSize !== undefined) { textFormat.fontSize = params.fontSize; fields.push("userEnteredFormat.textFormat.fontSize"); }
  if (params.fontFamily !== undefined) { textFormat.fontFamily = params.fontFamily; fields.push("userEnteredFormat.textFormat.fontFamily"); }
  if (params.textColor) { textFormat.foregroundColorStyle = { rgbColor: hexToColor(params.textColor) }; fields.push("userEnteredFormat.textFormat.foregroundColorStyle"); }
  if (Object.keys(textFormat).length > 0) cellFormat.textFormat = textFormat;

  if (params.backgroundColor) {
    cellFormat.backgroundColorStyle = { rgbColor: hexToColor(params.backgroundColor) };
    fields.push("userEnteredFormat.backgroundColorStyle");
  }
  if (params.horizontalAlignment) {
    cellFormat.horizontalAlignment = params.horizontalAlignment;
    fields.push("userEnteredFormat.horizontalAlignment");
  }
  if (params.verticalAlignment) {
    cellFormat.verticalAlignment = params.verticalAlignment;
    fields.push("userEnteredFormat.verticalAlignment");
  }
  if (params.wrapStrategy) {
    cellFormat.wrapStrategy = params.wrapStrategy;
    fields.push("userEnteredFormat.wrapStrategy");
  }
  if (params.numberFormat) {
    cellFormat.numberFormat = params.numberFormat;
    fields.push("userEnteredFormat.numberFormat");
  }

  if (fields.length === 0) throw new Error("At least one formatting property must be specified");

  const gridRange = parseGridRange(params.range, params.sheetId);

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    repeatCell: {
      range: gridRange,
      cell: { userEnteredFormat: cellFormat },
      fields: fields.join(","),
    },
  }]);

  return { formatted: true, range: params.range, appliedFields: fields, replies };
}

// ── sheets-update-borders ──────────────────────────────────────────────────

const borderStyleEnum = z
  .enum(["DOTTED", "DASHED", "SOLID", "SOLID_MEDIUM", "SOLID_THICK", "DOUBLE", "NONE"])
  .describe("Border style");

const borderSpec = z.object({
  style: borderStyleEnum,
  color: z.string().optional().describe("Border color as hex (e.g., '#000000'). Default: black"),
}).optional();

export const updateBordersSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID"),
  range: z.string().describe("A1 notation range"),
  top: borderSpec.describe("Top border"),
  bottom: borderSpec.describe("Bottom border"),
  left: borderSpec.describe("Left border"),
  right: borderSpec.describe("Right border"),
  innerHorizontal: borderSpec.describe("Inner horizontal borders"),
  innerVertical: borderSpec.describe("Inner vertical borders"),
});

export async function updateBorders(
  params: z.infer<typeof updateBordersSchema>,
) {
  assertWriteAllowed();

  const gridRange = parseGridRange(params.range, params.sheetId);

  function makeBorder(spec: { style: string; color?: string } | undefined) {
    if (!spec) return undefined;
    if (spec.style === "NONE") return { style: "NONE" };
    return {
      style: spec.style,
      colorStyle: { rgbColor: hexToColor(spec.color ?? "#000000") },
    };
  }

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    updateBorders: {
      range: gridRange,
      top: makeBorder(params.top),
      bottom: makeBorder(params.bottom),
      left: makeBorder(params.left),
      right: makeBorder(params.right),
      innerHorizontal: makeBorder(params.innerHorizontal),
      innerVertical: makeBorder(params.innerVertical),
    },
  }]);

  return { updated: true, range: params.range, replies };
}

// ── sheets-merge-cells ─────────────────────────────────────────────────────

export const mergeCellsSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID"),
  range: z.string().describe("A1 notation range to merge (e.g., 'A1:D1')"),
  mergeType: z
    .enum(["MERGE_ALL", "MERGE_COLUMNS", "MERGE_ROWS"])
    .optional()
    .default("MERGE_ALL")
    .describe("Merge type: MERGE_ALL (default), MERGE_COLUMNS, or MERGE_ROWS"),
});

export async function mergeCells(
  params: z.infer<typeof mergeCellsSchema>,
) {
  assertWriteAllowed();
  const gridRange = parseGridRange(params.range, params.sheetId);

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    mergeCells: { range: gridRange, mergeType: params.mergeType },
  }]);

  return { merged: true, range: params.range, mergeType: params.mergeType, replies };
}

// ── sheets-unmerge-cells ───────────────────────────────────────────────────

export const unmergeCellsSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID"),
  range: z.string().describe("A1 notation range to unmerge"),
});

export async function unmergeCells(
  params: z.infer<typeof unmergeCellsSchema>,
) {
  assertWriteAllowed();
  const gridRange = parseGridRange(params.range, params.sheetId);

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    unmergeCells: { range: gridRange },
  }]);

  return { unmerged: true, range: params.range, replies };
}

// ── sheets-sort-range ──────────────────────────────────────────────────────

export const sortRangeSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID"),
  range: z.string().describe("A1 notation range to sort (e.g., 'A1:D10')"),
  sortSpecs: z
    .array(
      z.object({
        columnIndex: z.coerce.number().describe("Zero-based column index to sort by"),
        sortOrder: z
          .enum(["ASCENDING", "DESCENDING"])
          .optional()
          .default("ASCENDING")
          .describe("Sort order. Default: ASCENDING"),
      }),
    )
    .describe("Sort specifications — array of column/order pairs"),
});

export async function sortRange(
  params: z.infer<typeof sortRangeSchema>,
) {
  assertWriteAllowed();
  const gridRange = parseGridRange(params.range, params.sheetId);

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    sortRange: {
      range: gridRange,
      sortSpecs: params.sortSpecs.map((s) => ({
        dimensionIndex: s.columnIndex,
        sortOrder: s.sortOrder,
      })),
    },
  }]);

  return { sorted: true, range: params.range, replies };
}

// ── sheets-find-replace ────────────────────────────────────────────────────

export const findReplaceSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  find: z.string().describe("The text to find"),
  replacement: z.string().describe("The text to replace with"),
  sheetId: z.coerce.number().optional().describe("Limit to a specific sheet (omit for all sheets)"),
  allSheets: z.boolean().optional().default(true).describe("Search all sheets. Default: true (ignored if sheetId is set)"),
  matchCase: z.boolean().optional().default(false).describe("Case-sensitive match. Default: false"),
  matchEntireCell: z.boolean().optional().default(false).describe("Match entire cell content only. Default: false"),
  searchByRegex: z.boolean().optional().default(false).describe("Treat 'find' as a regular expression. Default: false"),
  includeFormulas: z.boolean().optional().default(false).describe("Also search within formulas. Default: false"),
});

export async function findReplace(
  params: z.infer<typeof findReplaceSchema>,
) {
  assertWriteAllowed();

  const request: Record<string, unknown> = {
    find: params.find,
    replacement: params.replacement,
    matchCase: params.matchCase,
    matchEntireCell: params.matchEntireCell,
    searchByRegex: params.searchByRegex,
    includeFormulas: params.includeFormulas,
  };

  if (params.sheetId !== undefined) {
    request.sheetId = params.sheetId;
  } else {
    request.allSheets = params.allSheets;
  }

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{ findReplace: request }]);

  const findReplaceReply = replies[0] as { findReplace?: { valuesChanged?: number; formulasChanged?: number; rowsChanged?: number; sheetsChanged?: number; occurrencesChanged?: number } } | undefined;

  return {
    valuesChanged: findReplaceReply?.findReplace?.valuesChanged ?? 0,
    formulasChanged: findReplaceReply?.findReplace?.formulasChanged ?? 0,
    rowsChanged: findReplaceReply?.findReplace?.rowsChanged ?? 0,
    sheetsChanged: findReplaceReply?.findReplace?.sheetsChanged ?? 0,
    occurrencesChanged: findReplaceReply?.findReplace?.occurrencesChanged ?? 0,
  };
}

// ── sheets-insert-dimension ────────────────────────────────────────────────

export const insertDimensionSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID"),
  dimension: z.enum(["ROWS", "COLUMNS"]).describe("Whether to insert rows or columns"),
  startIndex: z.coerce.number().describe("Zero-based start index (insert before this position)"),
  endIndex: z.coerce.number().describe("Zero-based end index (exclusive). Number inserted = endIndex - startIndex"),
  inheritFromBefore: z.boolean().optional().default(false).describe("Inherit formatting from the row/column before. Default: false"),
});

export async function insertDimension(
  params: z.infer<typeof insertDimensionSchema>,
) {
  assertWriteAllowed();

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    insertDimension: {
      range: {
        sheetId: params.sheetId,
        dimension: params.dimension,
        startIndex: params.startIndex,
        endIndex: params.endIndex,
      },
      inheritFromBefore: params.inheritFromBefore,
    },
  }]);

  return {
    inserted: true,
    dimension: params.dimension,
    count: params.endIndex - params.startIndex,
    replies,
  };
}

// ── sheets-delete-dimension ────────────────────────────────────────────────

export const deleteDimensionSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID"),
  dimension: z.enum(["ROWS", "COLUMNS"]).describe("Whether to delete rows or columns"),
  startIndex: z.coerce.number().describe("Zero-based start index (inclusive)"),
  endIndex: z.coerce.number().describe("Zero-based end index (exclusive). Number deleted = endIndex - startIndex"),
});

export async function deleteDimension(
  params: z.infer<typeof deleteDimensionSchema>,
) {
  assertWriteAllowed();

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    deleteDimension: {
      range: {
        sheetId: params.sheetId,
        dimension: params.dimension,
        startIndex: params.startIndex,
        endIndex: params.endIndex,
      },
    },
  }]);

  return {
    deleted: true,
    dimension: params.dimension,
    count: params.endIndex - params.startIndex,
    replies,
  };
}

// ── sheets-copy-sheet-to ───────────────────────────────────────────────────

export const copySheetToSchema = z.object({
  spreadsheetId: z.string().describe("Source spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID to copy"),
  destinationSpreadsheetId: z.string().describe("Target spreadsheet ID to copy the sheet into"),
});

export async function copySheetTo(
  params: z.infer<typeof copySheetToSchema>,
) {
  assertWriteAllowed();
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.sheets.copyTo({
    spreadsheetId: params.spreadsheetId,
    sheetId: params.sheetId,
    requestBody: { destinationSpreadsheetId: params.destinationSpreadsheetId },
  });

  return {
    sheetId: response.data.sheetId,
    title: response.data.title,
    sheetType: response.data.sheetType,
  };
}

// ── sheets-duplicate-sheet ─────────────────────────────────────────────────

export const duplicateSheetSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID to duplicate"),
  newSheetName: z.string().optional().describe("Name for the new sheet. Default: 'Copy of <original>'"),
  insertSheetIndex: z.coerce.number().optional().describe("Zero-based position to insert the new sheet"),
});

export async function duplicateSheet(
  params: z.infer<typeof duplicateSheetSchema>,
) {
  assertWriteAllowed();

  const request: Record<string, unknown> = {
    sourceSheetId: params.sheetId,
  };
  if (params.newSheetName) request.newSheetName = params.newSheetName;
  if (params.insertSheetIndex !== undefined) request.insertSheetIndex = params.insertSheetIndex;

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    duplicateSheet: request,
  }]);

  const dupeReply = replies[0] as { duplicateSheet?: { properties?: { sheetId?: number; title?: string } } } | undefined;

  return {
    newSheetId: dupeReply?.duplicateSheet?.properties?.sheetId,
    newSheetTitle: dupeReply?.duplicateSheet?.properties?.title,
  };
}

// ── sheets-auto-resize ─────────────────────────────────────────────────────

export const autoResizeSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID"),
  dimension: z.enum(["ROWS", "COLUMNS"]).describe("Whether to auto-resize rows or columns"),
  startIndex: z.coerce.number().optional().default(0).describe("Zero-based start index. Default: 0"),
  endIndex: z.coerce.number().optional().describe("Zero-based end index (exclusive). Default: all"),
});

export async function autoResize(
  params: z.infer<typeof autoResizeSchema>,
) {
  assertWriteAllowed();

  const dimensionRange: Record<string, unknown> = {
    sheetId: params.sheetId,
    dimension: params.dimension,
    startIndex: params.startIndex,
  };
  if (params.endIndex !== undefined) dimensionRange.endIndex = params.endIndex;

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    autoResizeDimensions: { dimensions: dimensionRange },
  }]);

  return { resized: true, dimension: params.dimension, replies };
}

// ── sheets-set-data-validation ─────────────────────────────────────────────

export const setDataValidationSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID"),
  range: z.string().describe("A1 notation range to apply validation to"),
  ruleType: z
    .enum(["ONE_OF_LIST", "ONE_OF_RANGE", "NUMBER_BETWEEN", "NUMBER_NOT_BETWEEN", "NUMBER_GREATER", "NUMBER_LESS", "CUSTOM_FORMULA", "TEXT_CONTAINS", "TEXT_NOT_CONTAINS", "DATE_BEFORE", "DATE_AFTER", "BOOLEAN"])
    .describe("Validation rule type"),
  values: z
    .array(z.string())
    .optional()
    .describe("Values for the rule (e.g., dropdown options for ONE_OF_LIST, or [min, max] for NUMBER_BETWEEN, or [formula] for CUSTOM_FORMULA)"),
  strict: z.boolean().optional().default(true).describe("Reject invalid input. Default: true"),
  showCustomUi: z.boolean().optional().default(true).describe("Show dropdown UI for list validations. Default: true"),
  inputMessage: z.string().optional().describe("Help message shown when editing the cell"),
});

export async function setDataValidation(
  params: z.infer<typeof setDataValidationSchema>,
) {
  assertWriteAllowed();
  const gridRange = parseGridRange(params.range, params.sheetId);

  const conditionValues = (params.values ?? []).map((v) => {
    // ONE_OF_RANGE uses formula-style values
    if (params.ruleType === "ONE_OF_RANGE" || params.ruleType === "CUSTOM_FORMULA") {
      return { userEnteredValue: v };
    }
    return { userEnteredValue: v };
  });

  const rule: Record<string, unknown> = {
    condition: {
      type: params.ruleType,
      values: conditionValues,
    },
    strict: params.strict,
    showCustomUi: params.showCustomUi,
  };
  if (params.inputMessage) rule.inputMessage = params.inputMessage;

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    setDataValidation: {
      range: gridRange,
      rule,
    },
  }]);

  return { applied: true, range: params.range, ruleType: params.ruleType, replies };
}

// ── sheets-add-conditional-format ──────────────────────────────────────────

export const addConditionalFormatSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID"),
  range: z.string().describe("A1 notation range"),
  ruleType: z
    .enum(["BOOLEAN", "GRADIENT"])
    .describe("BOOLEAN for highlight rules, GRADIENT for color scales"),
  // Boolean rule fields
  conditionType: z
    .enum([
      "NUMBER_GREATER", "NUMBER_LESS", "NUMBER_EQ", "NUMBER_NOT_EQ",
      "NUMBER_GREATER_THAN_EQ", "NUMBER_LESS_THAN_EQ", "NUMBER_BETWEEN", "NUMBER_NOT_BETWEEN",
      "TEXT_CONTAINS", "TEXT_NOT_CONTAINS", "TEXT_STARTS_WITH", "TEXT_ENDS_WITH",
      "TEXT_EQ", "TEXT_NOT_EQ", "BLANK", "NOT_BLANK", "CUSTOM_FORMULA",
    ])
    .optional()
    .describe("Condition type (for BOOLEAN rules)"),
  conditionValues: z.array(z.string()).optional().describe("Condition values (e.g., threshold numbers, text to match, or custom formula)"),
  formatBackgroundColor: z.string().optional().describe("Background color hex for matching cells (BOOLEAN rules)"),
  formatTextColor: z.string().optional().describe("Text color hex for matching cells (BOOLEAN rules)"),
  formatBold: z.boolean().optional().describe("Bold for matching cells (BOOLEAN rules)"),
  // Gradient fields
  minType: z.enum(["MIN", "MAX", "NUMBER", "PERCENT", "PERCENTILE"]).optional().describe("Min point type (GRADIENT)"),
  minValue: z.string().optional().describe("Min point value (GRADIENT)"),
  minColor: z.string().optional().describe("Min color hex (GRADIENT)"),
  midType: z.enum(["NUMBER", "PERCENT", "PERCENTILE"]).optional().describe("Mid point type (GRADIENT, optional)"),
  midValue: z.string().optional().describe("Mid point value (GRADIENT)"),
  midColor: z.string().optional().describe("Mid color hex (GRADIENT)"),
  maxType: z.enum(["MIN", "MAX", "NUMBER", "PERCENT", "PERCENTILE"]).optional().describe("Max point type (GRADIENT)"),
  maxValue: z.string().optional().describe("Max point value (GRADIENT)"),
  maxColor: z.string().optional().describe("Max color hex (GRADIENT)"),
});

export async function addConditionalFormat(
  params: z.infer<typeof addConditionalFormatSchema>,
) {
  assertWriteAllowed();
  const gridRange = parseGridRange(params.range, params.sheetId);

  let rule: Record<string, unknown>;

  if (params.ruleType === "BOOLEAN") {
    if (!params.conditionType) throw new Error("conditionType is required for BOOLEAN rules");
    const format: Record<string, unknown> = {};
    if (params.formatBackgroundColor) format.backgroundColorStyle = { rgbColor: hexToColor(params.formatBackgroundColor) };
    if (params.formatTextColor) format.textFormat = { foregroundColorStyle: { rgbColor: hexToColor(params.formatTextColor) } };
    if (params.formatBold !== undefined) {
      format.textFormat = { ...(format.textFormat as Record<string, unknown> ?? {}), bold: params.formatBold };
    }

    rule = {
      booleanRule: {
        condition: {
          type: params.conditionType,
          values: (params.conditionValues ?? []).map((v) => ({ userEnteredValue: v })),
        },
        format,
      },
    };
  } else {
    // GRADIENT
    const gradientRule: Record<string, unknown> = {};
    if (params.minColor) {
      gradientRule.minpoint = {
        type: params.minType ?? "MIN",
        value: params.minValue,
        colorStyle: { rgbColor: hexToColor(params.minColor) },
      };
    }
    if (params.midColor) {
      gradientRule.midpoint = {
        type: params.midType ?? "PERCENTILE",
        value: params.midValue ?? "50",
        colorStyle: { rgbColor: hexToColor(params.midColor) },
      };
    }
    if (params.maxColor) {
      gradientRule.maxpoint = {
        type: params.maxType ?? "MAX",
        value: params.maxValue,
        colorStyle: { rgbColor: hexToColor(params.maxColor) },
      };
    }
    rule = { gradientRule };
  }

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    addConditionalFormatRule: {
      rule: { ranges: [gridRange], ...rule },
      index: 0,
    },
  }]);

  return { added: true, ruleType: params.ruleType, range: params.range, replies };
}

// ── sheets-add-chart ───────────────────────────────────────────────────────

export const addChartSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID where the chart will be placed"),
  chartType: z
    .enum(["BAR", "LINE", "AREA", "COLUMN", "SCATTER", "COMBO", "STEPPED_AREA"])
    .describe("Chart type"),
  title: z.string().optional().describe("Chart title"),
  dataSheetId: z.coerce.number().optional().describe("Sheet ID containing the data (defaults to sheetId)"),
  dataRange: z.string().describe("A1 notation range for chart data (e.g., 'A1:C10')"),
  headerCount: z.coerce.number().optional().default(1).describe("Number of header rows. Default: 1"),
  anchorCell: z.string().optional().default("E1").describe("Cell where the chart top-left corner is placed. Default: E1"),
});

export async function addChart(
  params: z.infer<typeof addChartSchema>,
) {
  assertWriteAllowed();

  const dataSheetId = params.dataSheetId ?? params.sheetId;
  const dataGridRange = parseGridRange(params.dataRange, dataSheetId);
  const anchor = parseCellRef(params.anchorCell ?? "E1");

  // Domain = first column only, Series = remaining columns (one per column)
  const domainRange = {
    ...dataGridRange,
    endColumnIndex: (dataGridRange.startColumnIndex as number) + 1,
  };

  const startCol = (dataGridRange.startColumnIndex as number) + 1;
  const endCol = dataGridRange.endColumnIndex as number;
  const seriesList = [];
  for (let col = startCol; col < endCol; col++) {
    seriesList.push({
      series: {
        sourceRange: {
          sources: [{
            ...dataGridRange,
            startColumnIndex: col,
            endColumnIndex: col + 1,
          }],
        },
      },
      targetAxis: "LEFT_AXIS",
    });
  }

  const spec: Record<string, unknown> = {
    title: params.title,
    basicChart: {
      chartType: params.chartType,
      legendPosition: "BOTTOM_LEGEND",
      headerCount: params.headerCount,
      domains: [{
        domain: { sourceRange: { sources: [domainRange] } },
      }],
      series: seriesList,
    },
  };

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    addChart: {
      chart: {
        spec,
        position: {
          overlayPosition: {
            anchorCell: {
              sheetId: params.sheetId,
              rowIndex: anchor.row,
              columnIndex: anchor.col,
            },
          },
        },
      },
    },
  }]);

  const chartReply = replies[0] as { addChart?: { chart?: { chartId?: number } } } | undefined;

  return {
    chartId: chartReply?.addChart?.chart?.chartId,
    chartType: params.chartType,
    title: params.title,
  };
}

// ── sheets-delete-chart ────────────────────────────────────────────────────

export const deleteChartSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  chartId: z.coerce.number().describe("The chart ID to delete"),
});

export async function deleteChart(
  params: z.infer<typeof deleteChartSchema>,
) {
  assertWriteAllowed();

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    deleteEmbeddedObject: { objectId: params.chartId },
  }]);

  return { deleted: true, chartId: params.chartId, replies };
}

// ── sheets-protected-range ─────────────────────────────────────────────────

export const addProtectedRangeSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID"),
  range: z.string().describe("A1 notation range to protect"),
  description: z.string().optional().describe("Description of why this range is protected"),
  warningOnly: z.boolean().optional().default(false).describe("Show warning instead of blocking edits. Default: false"),
  editors: z
    .array(z.string())
    .optional()
    .describe("Email addresses allowed to edit this range"),
});

export async function addProtectedRange(
  params: z.infer<typeof addProtectedRangeSchema>,
) {
  assertWriteAllowed();
  const gridRange = parseGridRange(params.range, params.sheetId);

  const protectedRange: Record<string, unknown> = {
    range: gridRange,
    warningOnly: params.warningOnly,
  };
  if (params.description) protectedRange.description = params.description;
  if (params.editors?.length) {
    protectedRange.editors = { users: params.editors };
  }

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    addProtectedRange: { protectedRange },
  }]);

  const prReply = replies[0] as { addProtectedRange?: { protectedRange?: { protectedRangeId?: number } } } | undefined;

  return {
    protectedRangeId: prReply?.addProtectedRange?.protectedRange?.protectedRangeId,
    range: params.range,
    warningOnly: params.warningOnly,
  };
}

// ── sheets-delete-protected-range ──────────────────────────────────────────

export const deleteProtectedRangeSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  protectedRangeId: z.coerce.number().describe("The protected range ID to remove"),
});

export async function deleteProtectedRange(
  params: z.infer<typeof deleteProtectedRangeSchema>,
) {
  assertWriteAllowed();

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    deleteProtectedRange: { protectedRangeId: params.protectedRangeId },
  }]);

  return { deleted: true, protectedRangeId: params.protectedRangeId, replies };
}

// ── sheets-named-range ─────────────────────────────────────────────────────

export const manageNamedRangeSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  action: z.enum(["add", "update", "delete"]).describe("Action: add, update, or delete"),
  namedRangeId: z.string().optional().describe("Named range ID (required for update and delete)"),
  name: z.string().optional().describe("Name for the range (required for add and update)"),
  sheetId: z.coerce.number().optional().describe("Numeric sheet ID (required for add and update)"),
  range: z.string().optional().describe("A1 notation range (required for add and update)"),
});

export async function manageNamedRange(
  params: z.infer<typeof manageNamedRangeSchema>,
) {
  assertWriteAllowed();

  let request: Record<string, unknown>;

  switch (params.action) {
    case "add": {
      if (!params.name || !params.range || params.sheetId === undefined)
        throw new Error("name, range, and sheetId are required for 'add'");
      const gridRange = parseGridRange(params.range, params.sheetId);
      request = { addNamedRange: { namedRange: { name: params.name, range: gridRange } } };
      break;
    }
    case "update": {
      if (!params.namedRangeId || !params.name || !params.range || params.sheetId === undefined)
        throw new Error("namedRangeId, name, range, and sheetId are required for 'update'");
      const gridRange = parseGridRange(params.range, params.sheetId);
      request = {
        updateNamedRange: {
          namedRange: { namedRangeId: params.namedRangeId, name: params.name, range: gridRange },
          fields: "name,range",
        },
      };
      break;
    }
    case "delete":
      if (!params.namedRangeId) throw new Error("namedRangeId is required for 'delete'");
      request = { deleteNamedRange: { namedRangeId: params.namedRangeId } };
      break;
  }

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [request]);
  return { action: params.action, replies };
}

// ── sheets-copy-paste ──────────────────────────────────────────────────────

export const copyPasteSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sourceSheetId: z.coerce.number().describe("Source sheet ID"),
  sourceRange: z.string().describe("Source A1 notation range"),
  destinationSheetId: z.coerce.number().describe("Destination sheet ID"),
  destinationRange: z.string().describe("Destination A1 notation range"),
  pasteType: z
    .enum(["PASTE_NORMAL", "PASTE_VALUES", "PASTE_FORMAT", "PASTE_NO_BORDERS", "PASTE_FORMULA", "PASTE_DATA_VALIDATION", "PASTE_CONDITIONAL_FORMATTING"])
    .optional()
    .default("PASTE_NORMAL")
    .describe("What to paste. Default: PASTE_NORMAL (everything)"),
  pasteOrientation: z
    .enum(["NORMAL", "TRANSPOSE"])
    .optional()
    .default("NORMAL")
    .describe("NORMAL or TRANSPOSE. Default: NORMAL"),
});

export async function copyPaste(
  params: z.infer<typeof copyPasteSchema>,
) {
  assertWriteAllowed();

  const source = parseGridRange(params.sourceRange, params.sourceSheetId);
  const destination = parseGridRange(params.destinationRange, params.destinationSheetId);

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    copyPaste: {
      source,
      destination,
      pasteType: params.pasteType,
      pasteOrientation: params.pasteOrientation,
    },
  }]);

  return { copied: true, pasteType: params.pasteType, replies };
}

// ── sheets-resize-dimensions ───────────────────────────────────────────────

export const resizeDimensionsSchema = z.object({
  spreadsheetId: z.string().describe("The spreadsheet ID"),
  sheetId: z.coerce.number().describe("Numeric sheet ID"),
  dimension: z.enum(["ROWS", "COLUMNS"]).describe("Whether to resize rows or columns"),
  startIndex: z.coerce.number().describe("Zero-based start index"),
  endIndex: z.coerce.number().describe("Zero-based end index (exclusive)"),
  pixelSize: z.coerce.number().describe("Size in pixels"),
});

export async function resizeDimensions(
  params: z.infer<typeof resizeDimensionsSchema>,
) {
  assertWriteAllowed();

  const replies = await batchUpdateSpreadsheet(params.spreadsheetId, [{
    updateDimensionProperties: {
      range: {
        sheetId: params.sheetId,
        dimension: params.dimension,
        startIndex: params.startIndex,
        endIndex: params.endIndex,
      },
      properties: { pixelSize: params.pixelSize },
      fields: "pixelSize",
    },
  }]);

  return { resized: true, dimension: params.dimension, pixelSize: params.pixelSize, replies };
}
