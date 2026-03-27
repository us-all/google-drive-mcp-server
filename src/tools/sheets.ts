import { z } from "zod";
import { getSheetsClient, getDriveClient } from "../client.js";
import { assertWriteAllowed } from "./utils.js";

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
  const sheets = getSheetsClient();

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

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: params.spreadsheetId,
    requestBody: { requests: [request] },
  });

  return {
    action: params.action,
    replies: response.data.replies,
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
