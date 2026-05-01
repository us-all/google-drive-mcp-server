import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "../src/tool-registry.js";

describe("ToolRegistry", () => {
  let r: ToolRegistry;

  beforeEach(() => {
    r = new ToolRegistry();
    r.register("list-files", "List files in a folder", "drive");
    r.register("get-file", "Get file metadata", "drive");
    r.register("sheets-get-values", "Read cell values", "sheets");
    r.register("sheets-update-values", "Write cell values", "sheets");
    r.register("docs-get-document", "Get document content", "docs");
    r.register("slides-get-presentation", "Get presentation", "slides");
  });

  it("matches by tool name token", () => {
    expect(r.search("file").map((m) => m.name)).toContain("list-files");
    expect(r.search("file").map((m) => m.name)).toContain("get-file");
  });

  it("respects category filter", () => {
    const matches = r.search("get", "docs");
    expect(matches.map((m) => m.name)).toEqual(["docs-get-document"]);
  });

  it("ranks name matches higher than description", () => {
    const matches = r.search("file");
    expect(matches[0].name).toMatch(/file/);
  });

  it("summary returns correct breakdown", () => {
    const s = r.summary();
    expect(s.total).toBe(6);
    expect(s.categoryBreakdown.drive).toBe(2);
    expect(s.categoryBreakdown.sheets).toBe(2);
  });
});
