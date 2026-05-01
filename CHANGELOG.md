# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2026-05-01

### Added

- **`summarize-doc` aggregation tool** — file metadata + extracted plain-text content + permissions + (opt) comments in a single call. Replaces 3-4 round-trips.

## [1.6.0] - 2026-05-01

### Added

- **MCP Resources (`gdrive://` URI scheme)** — `gdrive://file/{fileId}`, `gdrive://spreadsheet/{spreadsheetId}`, `gdrive://document/{documentId}`, `gdrive://presentation/{presentationId}`.

## [1.5.2] - 2026-05-01

### Added

- `pnpm token-stats` script + CI regression guard with `TOKEN_BUDGET=22000`.

## [1.5.1] - 2026-05-01

### Added

- **`extractFields` auto-apply** via `wrapToolHandler`. Schema field declared on `search-files`, `sheets-get-spreadsheet`, `sheets-get-values`, `sheets-batch-get-values`, `docs-get-document`, `slides-get-presentation`.

## [1.5.0] - 2026-05-01

### Added

- **Token efficiency standard** (cross-repo with openmetadata-mcp v1.3.0, datadog-mcp v1.9.0):
  - `GD_TOOLS` / `GD_DISABLE` env vars: 7 categories (drive, sheets, docs, slides, shared-drives, labels, approvals).
  - `search-tools` meta-tool.
  - `extractFields` parameter on `list-files` and `get-file`.
- `tests/extract-fields.test.ts` (3 cases), `tests/tool-registry.test.ts` (4 cases).

### Changed

- Total tools: 95 → 96.

## [1.4.1] - 2026-05-01

### Security

- Pin transitive `hono >=4.12.14` via `pnpm.overrides` to address [GHSA-458j-xx4x-4375](https://github.com/advisories/GHSA-458j-xx4x-4375) (medium, hono/jsx attribute key HTML injection). Not exploitable via this MCP (stdio transport, no JSX SSR), but applied for hygiene.

## [1.4.0] - 2026-05-01

### Changed

- Upgraded `googleapis` 148.0.0 → 171.4.0 (23 minor bumps incl. v165–v171 major lines).
- `google-auth-library` v9 → v10 pulled in transitively.
- All 66 unit tests pass without code changes — code uses only stable top-level auth surfaces (`GoogleAuth`, `OAuth2`, `getAccessToken`, `getClient`) which were unaffected by the v10 internal API removals (`Transporter`, `options.ts`, `messages.ts`, `additionalOptions`).

## [1.3.0] - 2026-04-20

### Added

- Google Docs API v1 support — 13 tools for document management, content editing, formatting, table/image/page-break insertion, multi-tab support.

## [1.2.x] - 2026-04-04

### Added

- Google Slides API v1 support — 20 tools for presentation management, slide editing, content insertion, formatting.

## [1.1.x] - 2026-03-30

### Added

- Google Sheets API v4 support — extensive sheet manipulation tools.
- Windows ADC path support (`%APPDATA%\gcloud\`).

## [1.0.0] - 2026-03-26

### Added

- Initial release with 30 MCP tools.
- Google Workspace awareness: auto-detect personal vs GWS accounts.
- Universal tools: files (CRUD), search, folders, permissions, export, comments, revisions, about, activity.
- GWS-only tools: Shared Drives, Labels (classification), Approvals.
- Dual authentication: OAuth2 and Service Account with domain-wide delegation.
- Write safety guard (`GOOGLE_DRIVE_ALLOW_WRITE`).
- GWS feature guard with clear error messages for personal accounts.
- Google Docs auto-export (Docs → Markdown, Sheets → CSV, Slides → text).
- Docker support (multi-stage Alpine build).
- CI/CD: GitHub Actions for build, test, npm publish, Docker publish.
- Bilingual documentation (English, Korean).
