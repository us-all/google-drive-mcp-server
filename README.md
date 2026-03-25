# Google Drive MCP Server

[한국어](./README_KO.md)

A Model Context Protocol (MCP) server for Google Drive with **Google Workspace awareness**. Unlike other Drive MCP servers, this one automatically detects your account type and unlocks GWS-exclusive features like Shared Drives, Labels, and Approvals.

## Highlights

| Feature | Personal | GWS Standard+ | GWS Enterprise |
|---------|----------|---------------|----------------|
| File CRUD, Search, Export | ✅ | ✅ | ✅ |
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

## Tools (30)

### Universal (Personal + GWS)

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

### GWS-Only (Google Workspace)

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
│  │  activity · shared-drives · labels        │   │
│  │  approvals                                │   │
│  └───────────────────────────────────────────┘   │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
              Google Drive API v3
              Drive Activity API v2
              Drive Labels API v2
```

## Authentication Setup

### OAuth2 (Personal or GWS)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the **Google Drive API**
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
- **Google API**: `googleapis` (Drive API v3, Drive Activity API v2, Drive Labels API v2)
- **Validation**: Zod
- **Package Manager**: pnpm
- **Test**: Vitest

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
