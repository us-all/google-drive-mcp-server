import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSpreadsheet,
  getValues,
  batchGetValues,
  updateValues,
  batchUpdateValues,
  appendValues,
  createSpreadsheet,
  manageSheets,
  clearValues,
  batchClearValues,
  formatCells,
  updateBorders,
  mergeCells,
  unmergeCells,
  sortRange,
  findReplace,
  insertDimension,
  deleteDimension,
  copySheetTo,
  duplicateSheet,
  autoResize,
  setDataValidation,
  addConditionalFormat,
  addChart,
  deleteChart,
  addProtectedRange,
  deleteProtectedRange,
  manageNamedRange,
  copyPaste,
  resizeDimensions,
} from "../src/tools/sheets.js";

// ── Mock Sheets client ──────────────────────────────────────────────────────

const mockSheetsGet = vi.fn();
const mockValuesGet = vi.fn();
const mockValuesBatchGet = vi.fn();
const mockValuesUpdate = vi.fn();
const mockValuesBatchUpdate = vi.fn();
const mockValuesAppend = vi.fn();
const mockValuesClear = vi.fn();
const mockValuesBatchClear = vi.fn();
const mockSpreadsheetsCreate = vi.fn();
const mockSpreadsheetsBatchUpdate = vi.fn();
const mockSheetsCopyTo = vi.fn();

vi.mock("../src/client.js", () => ({
  getSheetsClient: () => ({
    spreadsheets: {
      get: mockSheetsGet,
      create: mockSpreadsheetsCreate,
      batchUpdate: mockSpreadsheetsBatchUpdate,
      sheets: { copyTo: mockSheetsCopyTo },
      values: {
        get: mockValuesGet,
        batchGet: mockValuesBatchGet,
        update: mockValuesUpdate,
        batchUpdate: mockValuesBatchUpdate,
        append: mockValuesAppend,
        clear: mockValuesClear,
        batchClear: mockValuesBatchClear,
      },
    },
  }),
  getDriveClient: () => ({
    files: {
      update: vi.fn().mockResolvedValue({}),
    },
  }),
}));

// ── Mock write guard ────────────────────────────────────────────────────────

let writeAllowed = false;

vi.mock("../src/tools/utils.js", async () => {
  const actual = await vi.importActual<typeof import("../src/tools/utils.js")>(
    "../src/tools/utils.js",
  );
  return {
    ...actual,
    assertWriteAllowed: () => {
      if (!writeAllowed) throw new actual.WriteBlockedError();
    },
  };
});

// ── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  writeAllowed = false;
});

describe("sheets-get-spreadsheet", () => {
  it("returns spreadsheet metadata", async () => {
    mockSheetsGet.mockResolvedValue({
      data: {
        spreadsheetId: "abc123",
        properties: { title: "My Sheet", locale: "en_US", timeZone: "Asia/Seoul" },
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/abc123",
        sheets: [
          {
            properties: {
              sheetId: 0,
              title: "Sheet1",
              index: 0,
              sheetType: "GRID",
              gridProperties: { rowCount: 1000, columnCount: 26 },
            },
          },
        ],
      },
    });

    const result = await getSpreadsheet({ spreadsheetId: "abc123", includeGridData: false });

    expect(result.spreadsheetId).toBe("abc123");
    expect(result.title).toBe("My Sheet");
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets![0].title).toBe("Sheet1");
    expect(result.sheets![0].rowCount).toBe(1000);
    expect(mockSheetsGet).toHaveBeenCalledWith(
      expect.objectContaining({ spreadsheetId: "abc123", includeGridData: false }),
    );
  });
});

describe("sheets-get-values", () => {
  it("reads cell values from a range", async () => {
    mockValuesGet.mockResolvedValue({
      data: {
        range: "Sheet1!A1:B2",
        majorDimension: "ROWS",
        values: [["Name", "Age"], ["Alice", "30"]],
      },
    });

    const result = await getValues({
      spreadsheetId: "abc123",
      range: "Sheet1!A1:B2",
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    expect(result.values).toEqual([["Name", "Age"], ["Alice", "30"]]);
    expect(result.range).toBe("Sheet1!A1:B2");
  });

  it("returns empty array when no values", async () => {
    mockValuesGet.mockResolvedValue({
      data: { range: "Sheet1!A1:A1", majorDimension: "ROWS" },
    });

    const result = await getValues({
      spreadsheetId: "abc123",
      range: "Sheet1!A1:A1",
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    expect(result.values).toEqual([]);
  });
});

describe("sheets-batch-get-values", () => {
  it("reads multiple ranges", async () => {
    mockValuesBatchGet.mockResolvedValue({
      data: {
        spreadsheetId: "abc123",
        valueRanges: [
          { range: "Sheet1!A1:A2", values: [["a"], ["b"]] },
          { range: "Sheet1!B1:B2", values: [["1"], ["2"]] },
        ],
      },
    });

    const result = await batchGetValues({
      spreadsheetId: "abc123",
      ranges: ["Sheet1!A1:A2", "Sheet1!B1:B2"],
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    expect(result.valueRanges).toHaveLength(2);
    expect(result.valueRanges[0].values).toEqual([["a"], ["b"]]);
  });
});

describe("sheets-update-values", () => {
  it("blocks when write is disabled", async () => {
    await expect(
      updateValues({
        spreadsheetId: "abc123",
        range: "Sheet1!A1",
        values: [["hello"]],
        valueInputOption: "USER_ENTERED",
      }),
    ).rejects.toThrow("Write operations are disabled");
  });

  it("writes values when write is allowed", async () => {
    writeAllowed = true;
    mockValuesUpdate.mockResolvedValue({
      data: {
        updatedRange: "Sheet1!A1",
        updatedRows: 1,
        updatedColumns: 1,
        updatedCells: 1,
      },
    });

    const result = await updateValues({
      spreadsheetId: "abc123",
      range: "Sheet1!A1",
      values: [["hello"]],
      valueInputOption: "USER_ENTERED",
    });

    expect(result.updatedCells).toBe(1);
    expect(mockValuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: "abc123",
        range: "Sheet1!A1",
        valueInputOption: "USER_ENTERED",
      }),
    );
  });
});

describe("sheets-batch-update-values", () => {
  it("blocks when write is disabled", async () => {
    await expect(
      batchUpdateValues({
        spreadsheetId: "abc123",
        data: [{ range: "A1", values: [["x"]] }],
        valueInputOption: "USER_ENTERED",
      }),
    ).rejects.toThrow("Write operations are disabled");
  });

  it("writes multiple ranges when allowed", async () => {
    writeAllowed = true;
    mockValuesBatchUpdate.mockResolvedValue({
      data: {
        totalUpdatedRows: 2,
        totalUpdatedColumns: 2,
        totalUpdatedCells: 4,
        totalUpdatedSheets: 1,
      },
    });

    const result = await batchUpdateValues({
      spreadsheetId: "abc123",
      data: [
        { range: "A1:B1", values: [["a", "b"]] },
        { range: "A2:B2", values: [["c", "d"]] },
      ],
      valueInputOption: "USER_ENTERED",
    });

    expect(result.totalUpdatedCells).toBe(4);
  });
});

describe("sheets-append-values", () => {
  it("blocks when write is disabled", async () => {
    await expect(
      appendValues({
        spreadsheetId: "abc123",
        range: "Sheet1!A:B",
        values: [["new", "row"]],
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
      }),
    ).rejects.toThrow("Write operations are disabled");
  });

  it("appends rows when allowed", async () => {
    writeAllowed = true;
    mockValuesAppend.mockResolvedValue({
      data: {
        tableRange: "Sheet1!A1:B5",
        updates: {
          updatedRange: "Sheet1!A6:B6",
          updatedRows: 1,
          updatedColumns: 2,
          updatedCells: 2,
        },
      },
    });

    const result = await appendValues({
      spreadsheetId: "abc123",
      range: "Sheet1!A:B",
      values: [["new", "row"]],
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
    });

    expect(result.tableRange).toBe("Sheet1!A1:B5");
    expect(result.updatedRows).toBe(1);
  });
});

describe("sheets-create-spreadsheet", () => {
  it("blocks when write is disabled", async () => {
    await expect(
      createSpreadsheet({ title: "Test" }),
    ).rejects.toThrow("Write operations are disabled");
  });

  it("creates spreadsheet when allowed", async () => {
    writeAllowed = true;
    mockSpreadsheetsCreate.mockResolvedValue({
      data: {
        spreadsheetId: "new123",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/new123",
        properties: { title: "Test" },
        sheets: [{ properties: { sheetId: 0, title: "Sheet1" } }],
      },
    });

    const result = await createSpreadsheet({ title: "Test" });

    expect(result.spreadsheetId).toBe("new123");
    expect(result.title).toBe("Test");
  });

  it("creates with custom sheet names", async () => {
    writeAllowed = true;
    mockSpreadsheetsCreate.mockResolvedValue({
      data: {
        spreadsheetId: "new456",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/new456",
        properties: { title: "Multi" },
        sheets: [
          { properties: { sheetId: 0, title: "Data" } },
          { properties: { sheetId: 1, title: "Summary" } },
        ],
      },
    });

    const result = await createSpreadsheet({
      title: "Multi",
      sheetTitles: ["Data", "Summary"],
    });

    expect(result.sheets).toHaveLength(2);
    expect(result.sheets![0].title).toBe("Data");
    expect(mockSpreadsheetsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          sheets: [
            { properties: { title: "Data" } },
            { properties: { title: "Summary" } },
          ],
        }),
      }),
    );
  });
});

describe("sheets-manage-sheets", () => {
  it("blocks when write is disabled", async () => {
    await expect(
      manageSheets({ spreadsheetId: "abc123", action: "add", title: "New" }),
    ).rejects.toThrow("Write operations are disabled");
  });

  it("adds a sheet", async () => {
    writeAllowed = true;
    mockSpreadsheetsBatchUpdate.mockResolvedValue({
      data: { replies: [{ addSheet: { properties: { sheetId: 5, title: "New" } } }] },
    });

    const result = await manageSheets({
      spreadsheetId: "abc123",
      action: "add",
      title: "New",
    });

    expect(result.action).toBe("add");
    expect(mockSpreadsheetsBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: { requests: [{ addSheet: { properties: { title: "New" } } }] },
      }),
    );
  });

  it("deletes a sheet", async () => {
    writeAllowed = true;
    mockSpreadsheetsBatchUpdate.mockResolvedValue({
      data: { replies: [{}] },
    });

    await manageSheets({ spreadsheetId: "abc123", action: "delete", sheetId: 5 });

    expect(mockSpreadsheetsBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: { requests: [{ deleteSheet: { sheetId: 5 } }] },
      }),
    );
  });

  it("renames a sheet", async () => {
    writeAllowed = true;
    mockSpreadsheetsBatchUpdate.mockResolvedValue({
      data: { replies: [{}] },
    });

    await manageSheets({
      spreadsheetId: "abc123",
      action: "rename",
      sheetId: 0,
      title: "Renamed",
    });

    expect(mockSpreadsheetsBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: {
          requests: [{
            updateSheetProperties: {
              properties: { sheetId: 0, title: "Renamed" },
              fields: "title",
            },
          }],
        },
      }),
    );
  });

  it("throws when add is called without title", async () => {
    writeAllowed = true;
    await expect(
      manageSheets({ spreadsheetId: "abc123", action: "add" }),
    ).rejects.toThrow("title is required");
  });

  it("throws when delete is called without sheetId", async () => {
    writeAllowed = true;
    await expect(
      manageSheets({ spreadsheetId: "abc123", action: "delete" }),
    ).rejects.toThrow("sheetId is required");
  });
});

describe("sheets-clear-values", () => {
  it("blocks when write is disabled", async () => {
    await expect(
      clearValues({ spreadsheetId: "abc123", range: "Sheet1!A1:B2" }),
    ).rejects.toThrow("Write operations are disabled");
  });

  it("clears values when allowed", async () => {
    writeAllowed = true;
    mockValuesClear.mockResolvedValue({
      data: {
        spreadsheetId: "abc123",
        clearedRange: "Sheet1!A1:B2",
      },
    });

    const result = await clearValues({
      spreadsheetId: "abc123",
      range: "Sheet1!A1:B2",
    });

    expect(result.clearedRange).toBe("Sheet1!A1:B2");
  });
});

// ── New tools tests ─────────────────────────────────────────────────────────

const batchUpdateOk = () =>
  mockSpreadsheetsBatchUpdate.mockResolvedValue({ data: { replies: [{}] } });

describe("sheets-batch-clear-values", () => {
  it("blocks when write is disabled", async () => {
    await expect(
      batchClearValues({ spreadsheetId: "abc123", ranges: ["A1:B2"] }),
    ).rejects.toThrow("Write operations are disabled");
  });

  it("clears multiple ranges when allowed", async () => {
    writeAllowed = true;
    mockValuesBatchClear.mockResolvedValue({
      data: { spreadsheetId: "abc123", clearedRanges: ["A1:B2", "C1:D2"] },
    });

    const result = await batchClearValues({
      spreadsheetId: "abc123",
      ranges: ["A1:B2", "C1:D2"],
    });

    expect(result.clearedRanges).toHaveLength(2);
  });
});

describe("sheets-format-cells", () => {
  it("blocks when write is disabled", async () => {
    await expect(
      formatCells({ spreadsheetId: "abc123", sheetId: 0, range: "A1:B2", bold: true }),
    ).rejects.toThrow("Write operations are disabled");
  });

  it("applies bold formatting", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await formatCells({
      spreadsheetId: "abc123",
      sheetId: 0,
      range: "A1:B2",
      bold: true,
    });

    expect(result.formatted).toBe(true);
    expect(result.appliedFields).toContain("userEnteredFormat.textFormat.bold");
  });

  it("applies multiple formats", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await formatCells({
      spreadsheetId: "abc123",
      sheetId: 0,
      range: "A1",
      bold: true,
      fontSize: 14,
      backgroundColor: "#FFFF00",
      horizontalAlignment: "CENTER",
    });

    expect(result.appliedFields).toHaveLength(4);
  });

  it("throws when no formatting specified", async () => {
    writeAllowed = true;
    await expect(
      formatCells({ spreadsheetId: "abc123", sheetId: 0, range: "A1" }),
    ).rejects.toThrow("At least one formatting property");
  });
});

describe("sheets-update-borders", () => {
  it("blocks when write is disabled", async () => {
    await expect(
      updateBorders({ spreadsheetId: "abc123", sheetId: 0, range: "A1:B2", top: { style: "SOLID" } }),
    ).rejects.toThrow("Write operations are disabled");
  });

  it("sets borders when allowed", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await updateBorders({
      spreadsheetId: "abc123",
      sheetId: 0,
      range: "A1:B2",
      top: { style: "SOLID" },
      bottom: { style: "SOLID_THICK", color: "#FF0000" },
    });

    expect(result.updated).toBe(true);
  });
});

describe("sheets-merge-cells", () => {
  it("merges cells", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await mergeCells({
      spreadsheetId: "abc123",
      sheetId: 0,
      range: "A1:D1",
      mergeType: "MERGE_ALL",
    });

    expect(result.merged).toBe(true);
    expect(mockSpreadsheetsBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: {
          requests: [{ mergeCells: expect.objectContaining({ mergeType: "MERGE_ALL" }) }],
        },
      }),
    );
  });
});

describe("sheets-unmerge-cells", () => {
  it("unmerges cells", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await unmergeCells({
      spreadsheetId: "abc123",
      sheetId: 0,
      range: "A1:D1",
    });

    expect(result.unmerged).toBe(true);
  });
});

describe("sheets-sort-range", () => {
  it("sorts by column", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await sortRange({
      spreadsheetId: "abc123",
      sheetId: 0,
      range: "A1:D10",
      sortSpecs: [{ columnIndex: 0, sortOrder: "ASCENDING" }],
    });

    expect(result.sorted).toBe(true);
  });
});

describe("sheets-find-replace", () => {
  it("finds and replaces text", async () => {
    writeAllowed = true;
    mockSpreadsheetsBatchUpdate.mockResolvedValue({
      data: {
        replies: [{
          findReplace: {
            valuesChanged: 3,
            formulasChanged: 0,
            rowsChanged: 3,
            sheetsChanged: 1,
            occurrencesChanged: 5,
          },
        }],
      },
    });

    const result = await findReplace({
      spreadsheetId: "abc123",
      find: "old",
      replacement: "new",
      allSheets: true,
      matchCase: false,
      matchEntireCell: false,
      searchByRegex: false,
      includeFormulas: false,
    });

    expect(result.valuesChanged).toBe(3);
    expect(result.occurrencesChanged).toBe(5);
  });
});

describe("sheets-insert-dimension", () => {
  it("inserts rows", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await insertDimension({
      spreadsheetId: "abc123",
      sheetId: 0,
      dimension: "ROWS",
      startIndex: 2,
      endIndex: 5,
      inheritFromBefore: false,
    });

    expect(result.inserted).toBe(true);
    expect(result.count).toBe(3);
  });
});

describe("sheets-delete-dimension", () => {
  it("deletes columns", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await deleteDimension({
      spreadsheetId: "abc123",
      sheetId: 0,
      dimension: "COLUMNS",
      startIndex: 1,
      endIndex: 3,
    });

    expect(result.deleted).toBe(true);
    expect(result.count).toBe(2);
  });
});

describe("sheets-copy-sheet-to", () => {
  it("copies sheet to another spreadsheet", async () => {
    writeAllowed = true;
    mockSheetsCopyTo.mockResolvedValue({
      data: { sheetId: 99, title: "Copy of Sheet1", sheetType: "GRID" },
    });

    const result = await copySheetTo({
      spreadsheetId: "abc123",
      sheetId: 0,
      destinationSpreadsheetId: "dest456",
    });

    expect(result.sheetId).toBe(99);
    expect(result.title).toBe("Copy of Sheet1");
  });
});

describe("sheets-duplicate-sheet", () => {
  it("duplicates sheet within spreadsheet", async () => {
    writeAllowed = true;
    mockSpreadsheetsBatchUpdate.mockResolvedValue({
      data: {
        replies: [{ duplicateSheet: { properties: { sheetId: 10, title: "Sheet1 Copy" } } }],
      },
    });

    const result = await duplicateSheet({
      spreadsheetId: "abc123",
      sheetId: 0,
      newSheetName: "Sheet1 Copy",
    });

    expect(result.newSheetId).toBe(10);
    expect(result.newSheetTitle).toBe("Sheet1 Copy");
  });
});

describe("sheets-auto-resize", () => {
  it("auto-resizes columns", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await autoResize({
      spreadsheetId: "abc123",
      sheetId: 0,
      dimension: "COLUMNS",
      startIndex: 0,
    });

    expect(result.resized).toBe(true);
  });
});

describe("sheets-set-data-validation", () => {
  it("sets dropdown validation", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await setDataValidation({
      spreadsheetId: "abc123",
      sheetId: 0,
      range: "A1:A10",
      ruleType: "ONE_OF_LIST",
      values: ["Option A", "Option B", "Option C"],
      strict: true,
      showCustomUi: true,
    });

    expect(result.applied).toBe(true);
    expect(result.ruleType).toBe("ONE_OF_LIST");
  });
});

describe("sheets-add-conditional-format", () => {
  it("adds boolean highlight rule", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await addConditionalFormat({
      spreadsheetId: "abc123",
      sheetId: 0,
      range: "B2:B100",
      ruleType: "BOOLEAN",
      conditionType: "NUMBER_GREATER",
      conditionValues: ["100"],
      formatBackgroundColor: "#00FF00",
    });

    expect(result.added).toBe(true);
    expect(result.ruleType).toBe("BOOLEAN");
  });

  it("adds gradient color scale", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await addConditionalFormat({
      spreadsheetId: "abc123",
      sheetId: 0,
      range: "C1:C50",
      ruleType: "GRADIENT",
      minColor: "#FF0000",
      midColor: "#FFFF00",
      maxColor: "#00FF00",
    });

    expect(result.added).toBe(true);
    expect(result.ruleType).toBe("GRADIENT");
  });

  it("throws when BOOLEAN rule lacks conditionType", async () => {
    writeAllowed = true;
    await expect(
      addConditionalFormat({
        spreadsheetId: "abc123",
        sheetId: 0,
        range: "A1",
        ruleType: "BOOLEAN",
      }),
    ).rejects.toThrow("conditionType is required");
  });
});

describe("sheets-add-chart", () => {
  it("creates a chart", async () => {
    writeAllowed = true;
    mockSpreadsheetsBatchUpdate.mockResolvedValue({
      data: { replies: [{ addChart: { chart: { chartId: 42 } } }] },
    });

    const result = await addChart({
      spreadsheetId: "abc123",
      sheetId: 0,
      chartType: "BAR",
      title: "Sales",
      dataRange: "A1:C10",
      headerCount: 1,
      anchorCell: "E1",
    });

    expect(result.chartId).toBe(42);
    expect(result.chartType).toBe("BAR");
  });
});

describe("sheets-delete-chart", () => {
  it("deletes a chart", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await deleteChart({
      spreadsheetId: "abc123",
      chartId: 42,
    });

    expect(result.deleted).toBe(true);
  });
});

describe("sheets-add-protected-range", () => {
  it("protects a range", async () => {
    writeAllowed = true;
    mockSpreadsheetsBatchUpdate.mockResolvedValue({
      data: { replies: [{ addProtectedRange: { protectedRange: { protectedRangeId: 7 } } }] },
    });

    const result = await addProtectedRange({
      spreadsheetId: "abc123",
      sheetId: 0,
      range: "A1:D5",
      description: "Header row",
      warningOnly: false,
      editors: ["admin@example.com"],
    });

    expect(result.protectedRangeId).toBe(7);
  });
});

describe("sheets-delete-protected-range", () => {
  it("removes protection", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await deleteProtectedRange({
      spreadsheetId: "abc123",
      protectedRangeId: 7,
    });

    expect(result.deleted).toBe(true);
  });
});

describe("sheets-manage-named-range", () => {
  it("adds a named range", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await manageNamedRange({
      spreadsheetId: "abc123",
      action: "add",
      name: "MyRange",
      sheetId: 0,
      range: "A1:D10",
    });

    expect(result.action).toBe("add");
  });

  it("throws when add lacks required fields", async () => {
    writeAllowed = true;
    await expect(
      manageNamedRange({ spreadsheetId: "abc123", action: "add" }),
    ).rejects.toThrow("name, range, and sheetId are required");
  });

  it("deletes a named range", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await manageNamedRange({
      spreadsheetId: "abc123",
      action: "delete",
      namedRangeId: "nr-123",
    });

    expect(result.action).toBe("delete");
  });
});

describe("sheets-copy-paste", () => {
  it("copies and pastes a range", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await copyPaste({
      spreadsheetId: "abc123",
      sourceSheetId: 0,
      sourceRange: "A1:B5",
      destinationSheetId: 0,
      destinationRange: "D1:E5",
      pasteType: "PASTE_VALUES",
      pasteOrientation: "NORMAL",
    });

    expect(result.copied).toBe(true);
    expect(result.pasteType).toBe("PASTE_VALUES");
  });
});

describe("sheets-resize-dimensions", () => {
  it("resizes columns", async () => {
    writeAllowed = true;
    batchUpdateOk();

    const result = await resizeDimensions({
      spreadsheetId: "abc123",
      sheetId: 0,
      dimension: "COLUMNS",
      startIndex: 0,
      endIndex: 3,
      pixelSize: 200,
    });

    expect(result.resized).toBe(true);
    expect(result.pixelSize).toBe(200);
  });
});
