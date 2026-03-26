import { describe, it, expect, vi } from "vitest";

const mockList = vi.fn().mockResolvedValue({
  data: { files: [], nextPageToken: null },
});

// Mock googleapis — OAuth2 must be a real constructor
vi.mock("googleapis", () => {
  function OAuth2() {
    // @ts-expect-error mock
    this.setCredentials = vi.fn();
  }
  return {
    google: {
      auth: { OAuth2 },
      drive: vi.fn().mockReturnValue({
        files: { list: mockList },
      }),
    },
  };
});

describe("searchFiles query wrapping", () => {
  it("wraps plain text in fullText contains", async () => {
    mockList.mockClear();
    const { searchFiles } = await import("../src/tools/search.js");

    await searchFiles({ query: "budget report", pageSize: 10, corpora: "user", orderBy: "relevance" });

    const q = mockList.mock.calls[0][0]?.q as string;
    expect(q).toContain("fullText contains");
    expect(q).toContain("budget report");
    expect(q).toContain("trashed = false");
  });

  it("passes Drive query syntax through directly", async () => {
    mockList.mockClear();
    const { searchFiles } = await import("../src/tools/search.js");

    await searchFiles({
      query: "name contains 'report' and mimeType = 'application/pdf'",
      pageSize: 10,
      corpora: "user",
      orderBy: "relevance",
    });

    const q = mockList.mock.calls[0][0]?.q as string;
    expect(q).toContain("name contains 'report'");
    expect(q).not.toContain("fullText contains");
  });

  it("escapes single quotes in plain text queries", async () => {
    mockList.mockClear();
    const { searchFiles } = await import("../src/tools/search.js");

    await searchFiles({ query: "it's a test", pageSize: 10, corpora: "user", orderBy: "relevance" });

    const q = mockList.mock.calls[0][0]?.q as string;
    expect(q).toContain("it\\'s a test");
  });
});
