# Changelog

## 1.5.0 (2026-05-01)

### Added
- **Token efficiency patterns** (cross-repo standard with openmetadata-mcp v1.3.0, datadog-mcp v1.9.0):
  - `GD_TOOLS` / `GD_DISABLE` env vars: 7 categories (drive, sheets, docs, slides, shared-drives, labels, approvals)
  - `search-tools` meta-tool: discover tools by natural-language query
  - `extractFields` parameter on `list-files` and `get-file`: comma-separated dotted paths with `*` wildcard
- New unit tests: `tests/extract-fields.test.ts` (3 cases), `tests/tool-registry.test.ts` (4 cases)

### Changed
- Total tools: 95 → 96 (+search-tools meta)
- `src/index.ts` refactored: `server.tool()` → `tool()` helper with category filtering

## 1.4.1 (2026-05-01)

### Security
- Pin transitive `hono >=4.12.14` via `pnpm.overrides` to address [GHSA-458j-xx4x-4375](https://github.com/advisories/GHSA-458j-xx4x-4375) (medium, hono/jsx attribute key HTML injection). Not exploitable via this MCP (stdio transport, no JSX SSR), but applied for hygiene.

## 1.4.0 (2026-05-01)

### Changed
- Upgraded `googleapis` 148.0.0 → 171.4.0 (23 minor bumps incl. v165–v171 major lines)
- `google-auth-library` v9 → v10 pulled in transitively
- All 66 unit tests pass without code changes — code uses only stable top-level auth surfaces (`GoogleAuth`, `OAuth2`, `getAccessToken`, `getClient`) which were unaffected by the v10 internal API removals (`Transporter`, `options.ts`, `messages.ts`, `additionalOptions`)

## 1.0.0 (2026-03-26)

### Added
- Initial release with 30 MCP tools
- Google Workspace awareness: auto-detect personal vs GWS accounts
- Universal tools: files (CRUD), search, folders, permissions, export, comments, revisions, about, activity
- GWS-only tools: Shared Drives, Labels (classification), Approvals
- Dual authentication: OAuth2 and Service Account with domain-wide delegation
- Write safety guard (`GOOGLE_DRIVE_ALLOW_WRITE`)
- GWS feature guard with clear error messages for personal accounts
- Google Docs auto-export (Docs → Markdown, Sheets → CSV, Slides → text)
- Docker support (multi-stage Alpine build)
- CI/CD: GitHub Actions for build, test, npm publish, Docker publish
- Bilingual documentation (English, Korean)
