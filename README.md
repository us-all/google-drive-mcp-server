# Google Drive MCP Server

> **The Workspace power-editing MCP — formula-aware Sheets, full Slides editing, shared-drive audits the read-only Claude.ai connector deliberately won't ship.**
>
> 96 tools across Drive (24) + Docs (13) + Sheets (30) + Slides (20) + GWS admin (8) + aggregations (2). Service Account + Domain-Wide Delegation for org-scale automation. GWS-aware capability detection — features auto-unlock for Workspace accounts.

[![npm](https://img.shields.io/npm/v/@us-all/google-drive-mcp)](https://www.npmjs.com/package/@us-all/google-drive-mcp)
[![downloads](https://img.shields.io/npm/dm/@us-all/google-drive-mcp)](https://www.npmjs.com/package/@us-all/google-drive-mcp)
[![tools](https://img.shields.io/badge/tools-97-blue)](#tools)
[![@us-all standard](https://img.shields.io/badge/built%20to-%40us--all%20MCP%20standard-blue)](https://github.com/us-all/mcp-toolkit/blob/main/STANDARD.md)

## What it does that others don't

- **Deep Sheets editing** — charts, conditional formats, protected ranges, named ranges, data validation, borders, merge, sort, find/replace, formulas, A1-quote-doubling for CJK tab names. The 1st-party Workspace connector reads Sheets as CSV — formulas don't survive.
- **Full Slides editing** — presentations, slides, shapes, tables, images, formatting. Not in the connector at all.
- **Shared-Drive admin tooling** — `list-shared-drives`, `get-shared-drive`, `create-shared-drive`, list/share/remove permissions, file activity, labels, approvals. Workspace governance surface the connector deliberately doesn't expose.
- **3 auth modes** — OAuth2 (personal or GWS), Service Account + Domain-Wide Delegation (org-scale), Application Default Credentials (auto-detected).
- **Aggregation tools** — `audit-shared-drive-permissions` (sampling-based audit: anyone-with-link / external-domain / high-share findings in one call), `summarize-spreadsheet` (metadata + per-tab sample + named ranges), `summarize-doc` (file + content + permissions + comments).
- **MCP Prompts** (3) — `cleanup-shared-with-me`, `analyze-doc-structure`, `bulk-format-spreadsheet`.
- **GWS-aware** — `capabilities.ts` detects account type on startup; GWS-only tools return clear errors for personal accounts instead of mysterious 403s.

## Try this — 5 prompts

Connect the server to Claude Desktop or Claude Code, then paste any of these:

1. **Shared-drive permission audit** — *"Audit external shares across all my Shared Drives. List people outside `us-all.co.kr` who have access to anything. Group by drive, sort by access level."*
2. **Bulk conditional formatting** — *"Apply this conditional format to column `amount` across every `sales-*` spreadsheet in my drive: red if <0, yellow if 0–100, green if >100."*
3. **Slides from Doc outline** — *"Convert this Google Doc's outline into a 12-slide presentation: title slide, then 1 slide per H2 with H3 bullet points, end with a Q&A slide. Use the company template."*
4. **Doc structure analysis** — *"Analyze this Doc's structure: heading hierarchy, internal vs external link health, image alt-text coverage. Suggest 3 concrete improvements."*
5. **Cleanup shared-with-me** — *"Find files shared with me more than 180 days ago that I never opened. List them with sharer, last modified, and a guess at whether to keep."*

## When to use this vs alternatives

| | Anthropic 1st-party Workspace connector | taylorwilsdon/google_workspace_mcp | xing5/mcp-google-sheets | `@us-all/google-drive-mcp` (this) |
|--|---|---|---|---|
| Stars / availability | n/a (Claude.ai built-in, Feb 2026) | 2.3K★ | 836★ | — |
| Scope | Drive read + Sheets-as-CSV read | Gmail+Calendar+Drive+Docs+Sheets+Slides+Forms+Chat+Tasks+Contacts+Apps Script | Sheets only | Drive + Docs + Sheets + Slides + GWS admin |
| Sheets formula editing | ❌ (CSV round-trip loses formulas) | ✅ basic | ✅ specialist | ✅ deep (charts/conditional/named ranges) |
| Slides editing | ❌ | ✅ | ❌ | ✅ deep |
| Shared-drive admin | partial | ✅ | ❌ | ✅ deep |
| Folder operations | ❌ | ✅ | ❌ | ✅ |
| Aggregation tools | ❌ | ❌ | ❌ | ✅ `summarize-spreadsheet`, `summarize-doc` |
| MCP Prompts | ❌ | ❌ | ❌ | ✅ 4 |
| Auth modes | managed OAuth | OAuth + SA + stateless | SA / OAuth / ADC | OAuth + SA + DWD + ADC |
| Transport | n/a (Claude.ai-only) | stdio + HTTP | stdio | stdio |

**Use the 1st-party connector** for zero-config Drive read flows in Claude.ai. **Use taylorwilsdon** if you need the full Workspace surface (Gmail / Calendar / Forms etc.). **Use this server** for Drive + Docs + Sheets + Slides power-editing, shared-drive governance, and bulk operations the connector can't do.

## Install

### Claude Desktop

```json
{
  "mcpServers": {
    "google-drive": {
      "command": "npx",
      "args": ["-y", "@us-all/google-drive-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "<your-client-id>",
        "GOOGLE_CLIENT_SECRET": "<your-client-secret>",
        "GOOGLE_REFRESH_TOKEN": "<your-refresh-token>",
        "GOOGLE_DRIVE_ALLOW_WRITE": "true"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add google-drive -s user -- npx -y @us-all/google-drive-mcp
```

(Set env vars separately or in `.mcp.json`.)

### Docker

```bash
docker run --rm -i --env-file .env ghcr.io/us-all/google-drive-mcp-server
```

### Build from source

```bash
git clone https://github.com/us-all/google-drive-mcp-server.git
cd google-drive-mcp-server && pnpm install && pnpm build
node dist/index.js
```

## Auth setup

### OAuth2 (personal or GWS)

1. [Google Cloud Console](https://console.cloud.google.com/) → create project
2. Enable **Drive API**, **Docs API**, **Sheets API**, **Slides API**, **Drive Activity API**, **Drive Labels API**
3. Create OAuth2 credentials (Desktop App)
4. Get a refresh token (OAuth2 playground or your own flow)
5. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`

### Service Account + Domain-Wide Delegation (org-scale)

1. Create a Service Account in Google Cloud Console
2. Download the JSON key
3. Workspace Admin Console → **Security → API Controls → Domain-Wide Delegation** → add the SA's Client ID + grant required scopes
4. Set `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` and `GOOGLE_IMPERSONATE_USER`

### Application Default Credentials (zero-config)

`gcloud auth application-default login --client-id-file=client_secret.json --scopes=...` — auto-detected on startup. Windows ADC paths (`%APPDATA%\gcloud\`) supported.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth2 | — | OAuth2 Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth2 | — | OAuth2 Client Secret |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 | — | OAuth2 Refresh Token |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | SA | — | Path to service-account JSON key |
| `GOOGLE_IMPERSONATE_USER` | ❌ | — | GWS user email to impersonate (SA only) |
| `GOOGLE_DRIVE_ALLOW_WRITE` | ❌ | `false` | Set `true` to enable mutations |
| `GOOGLE_DRIVE_SCOPES` | ❌ | `drive.readonly` (or `drive` if write enabled) | Comma-sep OAuth scopes override |
| `GD_TOOLS` | ❌ | — | Comma-sep allowlist of categories. Biggest token saver. |
| `GD_DISABLE` | ❌ | — | Comma-sep denylist. Ignored when `GD_TOOLS` is set. |
| `MCP_TRANSPORT` | ❌ | `stdio` | `http` to enable Streamable HTTP transport |
| `MCP_HTTP_TOKEN` | conditional | — | Bearer token. Required when `MCP_TRANSPORT=http` |
| `MCP_HTTP_PORT` | ❌ | `3000` | HTTP listen port |
| `MCP_HTTP_HOST` | ❌ | `127.0.0.1` | HTTP bind host (DNS rebinding protection auto-enabled for localhost) |
| `MCP_HTTP_SKIP_AUTH` | ❌ | `false` | Skip Bearer auth — e.g. behind a reverse proxy that handles it |

**Categories** (7): `drive`, `sheets`, `docs`, `slides`, `shared-drives`, `labels`, `approvals`. Plus always-on `meta`.

When `MCP_TRANSPORT=http`: `POST /mcp` (Bearer-auth JSON-RPC) + `GET /health` (public liveness).

### Token efficiency

| Scenario | Tools | Schema tokens | vs default |
|----------|------:|--------------:|-----------:|
| default (all categories) | 96 | 18,400 | — |
| typical (`GD_TOOLS=drive,docs,sheets`) | 68 | 13,700 | −25% |
| narrow (`GD_TOOLS=drive`) | 25 | **4,000** | **−78%** |

`extractFields` projection on `list-files`/`get-file`/`sheets-get-spreadsheet`/`docs-get-document` (with `tabsCount`, `rowCount`, `columnCount`, `locale`, `timeZone` defaults). `list-files` slim default trims ~80% (drops `capabilities` 40-bool object + `contentRestrictions`).

## GWS detection

`capabilities.ts` detects account type at startup via `about.get()` + domain check:

| Feature | Personal | GWS Standard+ | GWS Enterprise |
|---|---|---|---|
| File CRUD / Search / Export | ✅ | ✅ | ✅ |
| Docs / Sheets / Slides editing | ✅ | ✅ | ✅ |
| Comments & Revisions | ✅ | ✅ | ✅ |
| Drive Activity | ✅ | ✅ | ✅ |
| **Shared Drives** | — | ✅ | ✅ |
| **Labels (classification)** | — | ✅ | ✅ |
| **Approvals** | — | ✅ | ✅ |
| **Domain-Wide Delegation** | — | ✅ | ✅ |

GWS-only tools throw `GWSFeatureError` with a clear message for personal accounts — no mysterious 403s.

## MCP Prompts (4)

Workflow templates available via MCP `prompts/list`:

- `audit-shared-drive-permissions` — fleet-wide external-share audit; flag access-level outliers.
- `cleanup-shared-with-me` — find untouched stale shares + suggest cleanup.
- `analyze-doc-structure` — heading hierarchy + link health + alt-text coverage.
- `bulk-format-spreadsheet` — apply consistent format across many sheets/tabs.

## MCP Resources

URI-based read-only access:

- `gdrive://file/{fileId}`
- `gdrive://spreadsheet/{spreadsheetId}`
- `gdrive://document/{documentId}`
- `gdrive://presentation/{presentationId}`
- `gdrive://folder/{folderId}`
- `gdrive://shared-drive/{driveId}` (GWS-gated)
- `gdrive://about/me`

## Tools (97)

7 categories. Use `search-tools` to discover at runtime; full list collapsed below.

| Category | Tools |
|----------|------:|
| Sheets (data / structure / formatting / advanced) | 30 |
| Drive (files / search / folders / permissions / export / comments / revisions / activity) | 24 |
| Slides (presentation / slide mgmt / content / formatting) | 20 |
| Docs (document / editing / formatting / elements) | 13 |
| GWS-only (shared drives / labels / approvals / audit) | 9 |
| Aggregations (`summarize-spreadsheet`, `summarize-doc`) | 2 |
| Meta (`search-tools`) | 1 |

<details>
<summary>Full tool list</summary>

### Drive (24)
`get-about`, `list-files`, `get-file`, `read-file`, `create-file`, `update-file`, `copy-file`, `delete-file`, `search-files`, `create-folder`, `move-file`, `get-folder-tree`, `list-permissions`, `share-file`, `remove-permission`, `export-file`, `get-download-link`, `list-comments`, `get-comment`, `create-comment`, `resolve-comment`, `list-revisions`, `get-revision`, `get-activity`

### Google Docs (13)
**Document**: `docs-get-document`, `docs-create-document`, `docs-get-content`, `docs-list-tabs`
**Editing**: `docs-insert-text`, `docs-delete-range`, `docs-replace-text`, `docs-batch-update`
**Formatting**: `docs-format-text`, `docs-format-paragraph`
**Elements**: `docs-insert-table`, `docs-insert-image`, `docs-insert-page-break`

### Google Sheets (30)
**Data**: `sheets-get-spreadsheet`, `sheets-get-values`, `sheets-batch-get-values`, `sheets-update-values`, `sheets-batch-update-values`, `sheets-append-values`, `sheets-clear-values`, `sheets-batch-clear-values`, `sheets-create-spreadsheet`, `sheets-manage-sheets`
**Structure**: `sheets-insert-dimension`, `sheets-delete-dimension`, `sheets-duplicate-sheet`, `sheets-copy-sheet-to`, `sheets-copy-paste`, `sheets-sort-range`, `sheets-find-replace`
**Formatting**: `sheets-format-cells`, `sheets-update-borders`, `sheets-merge-cells`, `sheets-unmerge-cells`, `sheets-auto-resize`, `sheets-resize-dimensions`
**Advanced**: `sheets-set-data-validation`, `sheets-add-conditional-format`, `sheets-add-chart`, `sheets-delete-chart`, `sheets-add-protected-range`, `sheets-delete-protected-range`, `sheets-manage-named-range`

### Google Slides (20)
**Presentation**: `slides-get-presentation`, `slides-create-presentation`, `slides-duplicate-presentation`
**Slide management**: `slides-get-slide`, `slides-add-slide`, `slides-delete-slide`, `slides-move-slide`, `slides-duplicate-slide`
**Content**: `slides-insert-text`, `slides-replace-text`, `slides-insert-text-box`, `slides-insert-image`, `slides-insert-table`, `slides-update-table-cell`, `slides-insert-shape`
**Formatting**: `slides-format-text`, `slides-format-shape`, `slides-resize-element`, `slides-set-slide-background`, `slides-batch-update`

### GWS-only (9)
`list-shared-drives`, `get-shared-drive`, `create-shared-drive`, `audit-shared-drive-permissions`, `list-file-labels`, `apply-label`, `remove-label`, `list-approvals`, `get-approval`

### Aggregations
`summarize-spreadsheet`, `summarize-doc`

### Meta
`search-tools` — query other tools by keyword; always enabled.

</details>

## Architecture

```
Claude → MCP stdio → src/index.ts
                      ├── config.ts (OAuth2 / SA / ADC)
                      ├── capabilities.ts (Personal vs GWS detect)
                      ├── client.ts (Google API auth)
                      └── tools/{files,search,folders,permissions,export,comments,revisions,
                                  about,activity,docs,sheets,slides,shared-drives,labels,approvals,
                                  aggregations}.ts
                                       ↓
                              Drive API v3 / Docs API v1 / Sheets API v4 /
                              Slides API v1 / Drive Activity API v2 / Drive Labels API v2
```

Built on [`@us-all/mcp-toolkit`](https://github.com/us-all/mcp-toolkit):
- `extractFields` — token-efficient response projections
- `aggregate(fetchers, caveats)` — fan-out helper for `summarize-doc`
- `createWrapToolHandler` — Google query-string `key=...` redaction + `WriteBlockedError` / `GWSFeatureError` passthrough + Google API error extraction
- `search-tools` meta-tool

`supportsAllDrives: true` is passed to every Drive API call so Shared Drives just work.

## Tech stack

Node.js 18+ • TypeScript strict ESM • pnpm • `@modelcontextprotocol/sdk` • `googleapis` (Drive v3 / Docs v1 / Sheets v4 / Slides v1 / Activity v2 / Labels v2) • zod • dotenv • vitest.

## Limitations

- **Approvals API** — `googleapis` SDK has no typed bindings; uses raw `fetch` with auth header extraction.
- **`search-files`** — auto-wraps plain text in `fullText contains '...'`; pass Drive query syntax directly for advanced searches.

## License

[MIT](./LICENSE)
