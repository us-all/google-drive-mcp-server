import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// MCP Prompts: pre-built workflow templates that clients can invoke. Each
// returns a user-facing instruction the LLM should follow, leveraging the
// already-registered Google Drive tools.

export function registerPrompts(server: McpServer): void {
  // The `audit-shared-drive-permissions` Prompt was removed in v1.13.0.
  // The new `audit-shared-drive-permissions` Tool delivers the same audit
  // (anyone-with-link / external / high-share findings) in a single call
  // instead of the multi-step orchestration this Prompt used to instruct.

  server.registerPrompt(
    "cleanup-shared-with-me",
    {
      title: "Cleanup 'Shared with me'",
      description:
        "Identify stale items in 'Shared with me' and propose (read-only) which permissions to remove.",
      argsSchema: {
        olderThanDays: z
          .string()
          .optional()
          .describe("Only consider items not modified within this many days (default: 180)"),
        mimeTypes: z
          .string()
          .optional()
          .describe(
            "Optional comma-separated MIME types to filter (e.g. 'application/vnd.google-apps.document,application/pdf')",
          ),
      },
    },
    ({ olderThanDays, mimeTypes }) => {
      const days = olderThanDays ?? "180";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Survey 'Shared with me' items older than ${days} days and propose which to remove yourself from. This is a read-only listing — the user decides which removals to execute.`,
                "",
                "Steps:",
                `1. Compute the ISO 8601 cutoff: today minus ${days} days (e.g. '2025-11-04T00:00:00').`,
                `2. Call \`get-about\` to capture the current user's email (needed to identify their permission row later).`,
                mimeTypes
                  ? `3. Call \`search-files\` with q=\`sharedWithMe and modifiedTime < '<cutoff>' and (${mimeTypes
                      .split(",")
                      .map((m: string) => `mimeType = '${m.trim()}'`)
                      .join(" or ")})\`, extractFields='files.*.id,files.*.name,files.*.mimeType,files.*.owners,files.*.modifiedTime,files.*.webViewLink'. Page through all results.`
                  : `3. Call \`search-files\` with q=\`sharedWithMe and modifiedTime < '<cutoff>'\`, extractFields='files.*.id,files.*.name,files.*.mimeType,files.*.owners,files.*.modifiedTime,files.*.webViewLink'. Page through all results.`,
                "4. Group results by primary owner email and by MIME type; compute counts and total size if available.",
                "5. For each candidate, call `list-permissions` (fileId={id}) to find the current user's permission row (matching the email from step 2). Capture its permissionId.",
                "6. Produce a markdown report:",
                "   - Per-owner breakdown (owner, item count, oldest modifiedTime).",
                "   - Per-mimeType breakdown.",
                "   - Suggested `remove-permission` call signatures: `remove-permission(fileId={id}, permissionId={pid})` for each item, grouped by owner.",
                "7. Explicitly note: NO writes performed. Ask the user which group(s) to actually remove before any `remove-permission` execution. Removal requires GOOGLE_DRIVE_ALLOW_WRITE=true.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "analyze-doc-structure",
    {
      title: "Analyze Google Doc structure",
      description:
        "Extract the heading hierarchy of a Google Doc, render an outline, and flag orphan or inconsistently styled headings.",
      argsSchema: {
        documentId: z.string().describe("Google Docs document ID"),
      },
    },
    ({ documentId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Analyze the heading structure of Google Doc ${documentId} and report any issues.`,
              "",
              "Steps:",
              `1. Call \`docs-get-document\` with documentId=${JSON.stringify(documentId)} to retrieve the full document body. If the doc is multi-tab, also call \`docs-list-tabs\` and process each tab.`,
              "2. Walk `body.content[]`. For each `paragraph` element, read `paragraph.paragraphStyle.namedStyleType`. Record entries whose namedStyleType is HEADING_1 through HEADING_6 — capture (level=N, text=concatenated `paragraph.elements[].textRun.content`, startIndex, textStyle summary: bold/italic/fontSize/foregroundColor).",
              "3. Render an indented outline (HEADING_1 = 0 indent, HEADING_2 = 2 spaces, etc.) showing the heading text and level.",
              "4. Flag orphan headings: any HEADING_N where the previous heading level is < N-1 (e.g. HEADING_1 → HEADING_3 skips a level).",
              "5. Flag inconsistent styling: group headings by level and report any level where text styles diverge (different fontSize, color, bold/italic) across instances. Show the dominant style and the outliers.",
              "6. Also flag: empty headings (no textRun content), duplicate heading text within the same level, and headings whose first child paragraph uses TITLE/SUBTITLE styles unexpectedly.",
              "7. Summarize: total heading count by level, # orphans, # styling inconsistencies, and concrete fix suggestions (e.g. 'apply HEADING_2 to <text> at index <N>' — these can be executed via `docs-format-paragraph` if the user wishes).",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "bulk-format-spreadsheet",
    {
      title: "Bulk format a spreadsheet",
      description:
        "Inspect a spreadsheet sheet and propose a coordinated sequence of formatting calls in one of three styles.",
      argsSchema: {
        spreadsheetId: z.string().describe("Spreadsheet ID"),
        sheetName: z.string().describe("Sheet (tab) name to format"),
        formatStyle: z
          .string()
          .optional()
          .describe("Style preset: 'clean' (default), 'report', or 'compact'"),
      },
    },
    ({ spreadsheetId, sheetName, formatStyle }) => {
      const style = formatStyle ?? "clean";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Propose a bulk formatting plan for sheet '${sheetName}' in spreadsheet ${spreadsheetId} using the '${style}' preset.`,
                "",
                "Caveat: All write tools (`sheets-format-cells`, `sheets-update-borders`, `sheets-merge-cells`, `sheets-auto-resize`) are gated by GOOGLE_DRIVE_ALLOW_WRITE=true. If writes are not enabled, present the plan as a dry run only.",
                "",
                "Steps:",
                `1. Call \`sheets-get-spreadsheet\` with spreadsheetId=${JSON.stringify(spreadsheetId)} (metadata only — do NOT request grid data). Locate the sheet whose properties.title == ${JSON.stringify(sheetName)}; capture its sheetId, gridProperties.rowCount, gridProperties.columnCount, gridProperties.frozenRowCount.`,
                "2. Call `sheets-get-values` with range=`${sheetName}!A1:Z1` to detect whether row 1 looks like a header row (non-empty string cells across the used columns).",
                `3. Build the formatting plan based on style='${style}':`,
                "   - 'clean': bold + light-gray background on row 1; freeze row 1; thin bottom border under row 1; auto-resize columns; default body font 10pt.",
                "   - 'report': bold + dark-blue background + white text on row 1; freeze row 1; alternating-row light-gray fill on body via `sheets-add-conditional-format` (ISEVEN(ROW())); thicker bottom border under header; merged title row above header (insert one row, merge A:lastCol, set 14pt bold center) using `sheets-insert-dimension` + `sheets-merge-cells` + `sheets-format-cells`; auto-resize.",
                "   - 'compact': 9pt font everywhere; tight row heights via `sheets-resize-dimensions` (~18px); bold header row only; no borders; freeze row 1.",
                "4. Emit the plan as an ordered list of tool calls with concrete arguments (sheetId, A1 ranges, color values, etc.). Show JSON-style argument snippets so the user can review before executing.",
                "5. Ask the user to confirm before executing. If confirmed and writes are enabled, run the calls in order; otherwise stop.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  );
}
