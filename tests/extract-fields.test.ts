import { describe, it, expect } from "vitest";
import { applyExtractFields } from "../src/tools/extract-fields.js";

describe("applyExtractFields", () => {
  it("returns data unchanged when expr is empty", () => {
    const data = { a: 1, b: 2 };
    expect(applyExtractFields(data, undefined)).toEqual(data);
    expect(applyExtractFields(data, "")).toEqual(data);
  });

  it("projects flat fields", () => {
    const data = { id: "1", name: "doc.pdf", mimeType: "application/pdf", size: "1234" };
    expect(applyExtractFields(data, "id,name")).toEqual({ id: "1", name: "doc.pdf" });
  });

  it("projects nested + array wildcards", () => {
    const data = {
      files: [
        { id: "1", name: "a.txt", owners: [{ emailAddress: "alice@x.com" }] },
        { id: "2", name: "b.txt", owners: [{ emailAddress: "bob@x.com" }] },
      ],
      count: 2,
    };
    expect(applyExtractFields(data, "count,files.*.id,files.*.owners.*.emailAddress")).toEqual({
      count: 2,
      files: [
        { id: "1", owners: [{ emailAddress: "alice@x.com" }] },
        { id: "2", owners: [{ emailAddress: "bob@x.com" }] },
      ],
    });
  });
});
