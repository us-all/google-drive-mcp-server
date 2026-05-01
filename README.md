# Google Drive MCP Server

[한국어](./README_KO.md)

A Model Context Protocol (MCP) server for Google Drive with **Google Workspace awareness**. Unlike other Drive MCP servers, this one automatically detects your account type and unlocks GWS-exclusive features like Shared Drives, Labels, and Approvals.

## Highlights

| Feature | Personal | GWS Standard+ | GWS Enterprise |
|---------|----------|---------------|----------------|
| File CRUD, Search, Export | ✅ | ✅ | ✅ |
| **Google Docs (13 tools)** | ✅ | ✅ | ✅ |
| **Google Sheets (30 tools)** | ✅ | ✅ | ✅ |
| **Google Slides (20 tools)** | ✅ | ✅ | ✅ |
| Comments & Revisions | ✅ | ✅ | ✅ |
| Drive Activity | ✅ | ✅ | ✅ |
| Content Restrictions | ✅ | ✅ | ✅ |
| **Shared Drives** | — | ✅ | ✅ |
| **Labels (Classification)** | — | ✅ | ✅ |
| **Approvals** | — | ✅ | ✅ |
| **Domain-wide Delegation** | — | ✅ | ✅ |

## Quick Start

### Option 1: npx

```bash
# OAuth2 (personal or GWS)
GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... \
  npx @us-all/google-drive-mcp

# Service Account with domain-wide delegation (GWS)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account.json GOOGLE_IMPERSONATE_USER=user@company.com \
  npx @us-all/google-drive-mcp
```

### Option 2: Docker

```bash
docker run -i --env-file .env ghcr.io/us-all/google-drive-mcp-server
```

### Option 3: From source

```bash
git clone https://github.com/us-all/google-drive-mcp-server.git
cd google-drive-mcp-server
pnpm install
pnpm run build
pnpm start
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth2 | OAuth2 Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth2 | OAuth2 Client Secret |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 | OAuth2 Refresh Token |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | SA | Path to service account JSON key file |
| `GOOGLE_IMPERSONATE_USER` | No | GWS user email to impersonate (Service Account only) |
| `GOOGLE_DRIVE_ALLOW_WRITE` | No | Set to `true` to enable write operations. Default: `false` |
| `GOOGLE_DRIVE_SCOPES` | No | Comma-separated OAuth scopes. Default: `drive.readonly` (or `drive` if write enabled) |
| `GD_TOOLS` | No | Allowlist of tool categories (e.g. `drive,docs,sheets`). When set, only these load. Categories: `drive`, `sheets`, `docs`, `slides`, `shared-drives`, `labels`, `approvals`. Saves LLM context tokens. |
| `GD_DISABLE` | No | Denylist of categories (e.g. `slides,labels`). Ignored when `GD_TOOLS` is set. |

### Claude Desktop

```json
{
  "mcpServers": {
    "google-drive": {
      "command": "npx",
      "args": ["-y", "@us-all/google-drive-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id",
        "GOOGLE_CLIENT_SECRET": "your-client-secret",
        "GOOGLE_REFRESH_TOKEN": "your-refresh-token"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add google-drive -- npx -y @us-all/google-drive-mcp
```

## Tools (95)

### Drive (24 tools — Personal + GWS)

| Tool | Description | R/W |
|------|-------------|-----|
| `get-about` | Account info, storage quota, detected capabilities | R |
| `list-files` | List files in a folder | R |
| `get-file` | File metadata with properties and capabilities | R |
| `read-file` | Read file content (auto-exports Google Docs → Markdown, Sheets → CSV) | R |
| `create-file` | Create a new file | W |
| `update-file` | Update file name/content | W |
| `copy-file` | Copy a file | W |
| `delete-file` | Trash or permanently delete | W |
| `search-files` | Full-text and metadata search with Drive query syntax | R |
| `create-folder` | Create a folder | W |
| `move-file` | Move file/folder to another parent | W |
| `get-folder-tree` | Hierarchical folder tree (depth 1-5) | R |
| `list-permissions` | List sharing permissions | R |
| `share-file` | Share with user/group/domain/anyone | W |
| `remove-permission` | Remove a sharing permission | W |
| `export-file` | Export Google Docs/Sheets/Slides to PDF, DOCX, CSV, etc. | R |
| `get-download-link` | Get download and view links | R |
| `list-comments` | List comments on a file | R |
| `get-comment` | Get comment details with replies | R |
| `create-comment` | Add a comment | W |
| `resolve-comment` | Mark a comment as resolved | W |
| `list-revisions` | List file revision history | R |
| `get-revision` | Get specific revision details | R |
| `get-activity` | File/folder activity history (edits, views, permission changes) | R |

### Google Docs (13 tools)

**Document**

| Tool | Description | R/W |
|------|-------------|-----|
| `docs-get-document` | Document metadata — title, revision ID, tabs summary | R |
| `docs-create-document` | Create a new document | W |
| `docs-get-content` | Read content as plain text or structured JSON with indices | R |
| `docs-list-tabs` | List all tabs with IDs, titles, and nesting structure | R |

**Editing**

| Tool | Description | R/W |
|------|-------------|-----|
| `docs-insert-text` | Insert text at a position or end of segment | W |
| `docs-delete-range` | Delete content within an index range | W |
| `docs-replace-text` | Find and replace text across document or specific tabs | W |
| `docs-batch-update` | Raw batchUpdate for advanced operations | W |

**Formatting**

| Tool | Description | R/W |
|------|-------------|-----|
| `docs-format-text` | Bold, italic, underline, strikethrough, font, size, color, links | W |
| `docs-format-paragraph` | Alignment, heading level, spacing, indentation | W |

**Elements**

| Tool | Description | R/W |
|------|-------------|-----|
| `docs-insert-table` | Insert a table with rows and columns | W |
| `docs-insert-image` | Insert an inline image from URL | W |
| `docs-insert-page-break` | Insert a page break | W |

### Google Sheets (30 tools)

**Data**

| Tool | Description | R/W |
|------|-------------|-----|
| `sheets-get-spreadsheet` | Spreadsheet metadata — title, locale, sheets (tabs) | R |
| `sheets-get-values` | Read cell values from a range (A1 notation) | R |
| `sheets-batch-get-values` | Read multiple ranges in one request | R |
| `sheets-update-values` | Write values to a range | W |
| `sheets-batch-update-values` | Write to multiple ranges in one request | W |
| `sheets-append-values` | Append rows to the end of a table | W |
| `sheets-clear-values` | Clear values from a range | W |
| `sheets-batch-clear-values` | Clear multiple ranges at once | W |
| `sheets-create-spreadsheet` | Create a new spreadsheet | W |
| `sheets-manage-sheets` | Add, delete, or rename sheets (tabs) | W |

**Structure**

| Tool | Description | R/W |
|------|-------------|-----|
| `sheets-insert-dimension` | Insert rows or columns at a position | W |
| `sheets-delete-dimension` | Delete rows or columns | W |
| `sheets-duplicate-sheet` | Duplicate a sheet within the spreadsheet | W |
| `sheets-copy-sheet-to` | Copy a sheet to another spreadsheet | W |
| `sheets-copy-paste` | Copy/paste ranges with paste type control | W |
| `sheets-sort-range` | Sort a range by columns | W |
| `sheets-find-replace` | Find and replace text (supports regex) | W |

**Formatting**

| Tool | Description | R/W |
|------|-------------|-----|
| `sheets-format-cells` | Bold, italic, font, colors, alignment, number format | W |
| `sheets-update-borders` | Set borders on a range | W |
| `sheets-merge-cells` | Merge cells (all, columns, or rows) | W |
| `sheets-unmerge-cells` | Unmerge previously merged cells | W |
| `sheets-auto-resize` | Auto-fit column widths or row heights | W |
| `sheets-resize-dimensions` | Set explicit row height or column width | W |

**Advanced**

| Tool | Description | R/W |
|------|-------------|-----|
| `sheets-set-data-validation` | Dropdowns, number constraints, custom formulas | W |
| `sheets-add-conditional-format` | Highlight rules or color gradient scales | W |
| `sheets-add-chart` | Create embedded charts (bar, line, column, scatter, etc.) | W |
| `sheets-delete-chart` | Delete an embedded chart | W |
| `sheets-add-protected-range` | Protect a range (restrict editors) | W |
| `sheets-delete-protected-range` | Remove range protection | W |
| `sheets-manage-named-range` | Add, update, or delete named ranges | W |

### Google Slides (20 tools)

**Presentation**

| Tool | Description | R/W |
|------|-------------|-----|
| `slides-get-presentation` | Get presentation metadata, slides list, and layout info | R |
| `slides-create-presentation` | Create a new presentation | W |
| `slides-duplicate-presentation` | Duplicate an existing presentation (via Drive copy) | W |

**Slide Management**

| Tool | Description | R/W |
|------|-------------|-----|
| `slides-get-slide` | Get slide details with all elements | R |
| `slides-add-slide` | Add a new slide with optional layout | W |
| `slides-delete-slide` | Delete a slide | W |
| `slides-move-slide` | Reorder a slide | W |
| `slides-duplicate-slide` | Duplicate a slide within the presentation | W |

**Content**

| Tool | Description | R/W |
|------|-------------|-----|
| `slides-insert-text` | Insert text into an existing text box | W |
| `slides-replace-text` | Find and replace text across the presentation | W |
| `slides-insert-text-box` | Create a new text box with text | W |
| `slides-insert-image` | Insert an image from URL | W |
| `slides-insert-table` | Create a table | W |
| `slides-update-table-cell` | Update text in a table cell | W |
| `slides-insert-shape` | Insert a shape (rectangle, ellipse, etc.) | W |

**Formatting**

| Tool | Description | R/W |
|------|-------------|-----|
| `slides-format-text` | Text style (font, size, color, bold, italic) | W |
| `slides-format-shape` | Shape fill color and border | W |
| `slides-resize-element` | Change element size and position | W |
| `slides-set-slide-background` | Set slide background color | W |
| `slides-batch-update` | Raw batchUpdate for advanced operations | W |

### GWS-Only (8 tools — Google Workspace)

| Tool | Description | R/W |
|------|-------------|-----|
| `list-shared-drives` | List accessible Shared Drives | R |
| `get-shared-drive` | Shared Drive details and capabilities | R |
| `create-shared-drive` | Create a new Shared Drive | W |
| `list-file-labels` | List classification labels on a file | R |
| `apply-label` | Apply a label with field values | W |
| `remove-label` | Remove a label from a file | W |
| `list-approvals` | List file approval requests | R |
| `get-approval` | Get approval details and reviewer responses | R |

## Architecture

```
Claude / AI Client
       │
       ▼ (MCP Protocol over stdio)
┌──────────────────────────────────────────────────┐
│  google-drive MCP Server                         │
│                                                  │
│  ┌────────────┐  ┌──────────────────────────┐    │
│  │ config.ts  │  │ capabilities.ts          │    │
│  │ (env/auth) │  │ (personal vs GWS detect) │    │
│  └─────┬──────┘  └────────────┬─────────────┘    │
│        │                      │                  │
│  ┌─────▼──────────────────────▼─────────────┐    │
│  │              client.ts                   │    │
│  │  (OAuth2 / Service Account + Delegation) │    │
│  └─────────────────┬────────────────────────┘    │
│                    │                             │
│  ┌─────────────────▼─────────────────────────┐   │
│  │               tools/                      │   │
│  │  files · search · folders · permissions   │   │
│  │  export · comments · revisions · about    │   │
│  │  activity · docs · sheets · slides          │   │
│  │  shared-drives · labels · approvals       │   │
│  └───────────────────────────────────────────┘   │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
              Google Drive API v3
              Google Docs API v1
              Google Sheets API v4
              Google Slides API v1
              Drive Activity API v2
              Drive Labels API v2
```

## Authentication Setup

### OAuth2 (Personal or GWS)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the **Google Drive API**, **Google Docs API**, **Google Sheets API**, and **Google Slides API**
3. Create OAuth2 credentials (Desktop App type)
4. Get a refresh token using the OAuth2 playground or your own flow
5. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`

### Service Account (GWS with Domain-Wide Delegation)

1. Create a Service Account in Google Cloud Console
2. Download the JSON key file
3. In Google Workspace Admin Console:
   - Go to **Security > API Controls > Domain-wide Delegation**
   - Add the service account's Client ID
   - Grant the required OAuth scopes
4. Set `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` and `GOOGLE_IMPERSONATE_USER`

## Write Safety

All write operations (create, update, delete, share) are **disabled by default**. Set `GOOGLE_DRIVE_ALLOW_WRITE=true` to enable them. GWS-only tools will return a clear error message when used with a personal Google account.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript (strict mode)
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **Google API**: `googleapis` (Drive API v3, Docs API v1, Sheets API v4, Slides API v1, Drive Activity API v2, Drive Labels API v2)
- **Validation**: Zod
- **Package Manager**: pnpm
- **Test**: Vitest

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
