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
} from "../src/tools/sheets.js";

// ── Mock Sheets client ──────────────────────────────────────────────────────

const mockSheetsGet = vi.fn();
const mockValuesGet = vi.fn();
const mockValuesBatchGet = vi.fn();
const mockValuesUpdate = vi.fn();
const mockValuesBatchUpdate = vi.fn();
const mockValuesAppend = vi.fn();
const mockValuesClear = vi.fn();
const mockSpreadsheetsCreate = vi.fn();
const mockSpreadsheetsBatchUpdate = vi.fn();

vi.mock("../src/client.js", () => ({
  getSheetsClient: () => ({
    spreadsheets: {
      get: mockSheetsGet,
      create: mockSpreadsheetsCreate,
      batchUpdate: mockSpreadsheetsBatchUpdate,
      values: {
        get: mockValuesGet,
        batchGet: mockValuesBatchGet,
        update: mockValuesUpdate,
        batchUpdate: mockValuesBatchUpdate,
        append: mockValuesAppend,
        clear: mockValuesClear,
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
