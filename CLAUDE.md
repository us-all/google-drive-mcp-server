# Google Drive MCP Server

## Tech Stack
- Node.js 18+, pnpm, TypeScript (strict, ESM)
- `@modelcontextprotocol/sdk` — MCP protocol
- `googleapis` — Google Drive API v3, Drive Activity API v2, Drive Labels API v2, Sheets API v4
- `zod` — input validation
- `dotenv` — env loading
- `vitest` — testing

## Build & Run
```bash
pnpm install
pnpm run build
pnpm start              # or: node dist/index.js
pnpm run dev            # watch mode
pnpm run test           # unit tests
pnpm run smoke          # live API smoke test
```

## Architecture
```
Claude → MCP (stdio) → index.ts → tools/* → googleapis → Google Drive API
                              ↑
                    capabilities.ts (personal vs GWS detection)
```

## Tool Pattern
Each tool file exports: `schema` (Zod) + `handler` (async function).
Registration in `index.ts`: `server.tool(name, description, schema.shape, wrapToolHandler(handler))`.

Every schema field must have `.describe()`. Use `z.coerce.number()` for numbers.
Always pass `supportsAllDrives: true` to Drive API calls.

## GWS Awareness
- `capabilities.ts` detects account type on startup via `about.get()` + domain check
- GWS-only tools call `requireGWS(caps, "Feature Name")` which throws `GWSFeatureError` for personal accounts
- Write tools call `assertWriteAllowed()` which checks `GOOGLE_DRIVE_ALLOW_WRITE=true`

## Auth Methods
- **OAuth2**: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_REFRESH_TOKEN`
- **Service Account**: `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` + optional `GOOGLE_IMPERSONATE_USER`

## Tool Categories (62 tools)

| File | Tools |
|------|-------|
| `files.ts` | `list-files`, `get-file`, `read-file`, `create-file`, `update-file`, `copy-file`, `delete-file` |
| `search.ts` | `search-files` |
| `folders.ts` | `create-folder`, `move-file`, `get-folder-tree` |
| `permissions.ts` | `list-permissions`, `share-file`, `remove-permission` |
| `export.ts` | `export-file`, `get-download-link` |
| `comments.ts` | `list-comments`, `get-comment`, `create-comment`, `resolve-comment` |
| `revisions.ts` | `list-revisions`, `get-revision` |
| `about.ts` | `get-about` |
| `activity.ts` | `get-activity` |
| `sheets.ts` | **Data**: `sheets-get-spreadsheet`, `sheets-get-values`, `sheets-batch-get-values`, `sheets-update-values`, `sheets-batch-update-values`, `sheets-append-values`, `sheets-clear-values`, `sheets-batch-clear-values`, `sheets-create-spreadsheet`, `sheets-manage-sheets` |
|  | **Structure**: `sheets-insert-dimension`, `sheets-delete-dimension`, `sheets-duplicate-sheet`, `sheets-copy-sheet-to`, `sheets-copy-paste`, `sheets-sort-range`, `sheets-find-replace` |
|  | **Formatting**: `sheets-format-cells`, `sheets-update-borders`, `sheets-merge-cells`, `sheets-unmerge-cells`, `sheets-auto-resize`, `sheets-resize-dimensions` |
|  | **Advanced**: `sheets-set-data-validation`, `sheets-add-conditional-format`, `sheets-add-chart`, `sheets-delete-chart`, `sheets-add-protected-range`, `sheets-delete-protected-range`, `sheets-manage-named-range` |
| `shared-drives.ts` | `list-shared-drives`, `get-shared-drive`, `create-shared-drive` (GWS) |
| `labels.ts` | `list-file-labels`, `apply-label`, `remove-label` (GWS) |
| `approvals.ts` | `list-approvals`, `get-approval` (GWS) |

## Known Limitations

- Approvals API: `googleapis` SDK has no typed bindings yet — uses raw `fetch` with auth header extraction
- `search-files`: Auto-wraps plain text queries in `fullText contains '...'`; pass Drive query syntax directly for advanced searches
