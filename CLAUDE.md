# Google Drive MCP Server

## Tech Stack
- Node.js 18+, pnpm, TypeScript (strict, ESM)
- `@modelcontextprotocol/sdk` — MCP protocol
- `googleapis` — Google Drive API v3, Drive Activity API v2, Drive Labels API v2, Sheets API v4, Slides API v1, Docs API v1
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
- **ADC**: `gcloud auth application-default login --client-id-file=client_secret.json --scopes=...` (auto-detected)

## Tool Categories (95 tools)

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
| `docs.ts` | **Document**: `docs-get-document`, `docs-create-document`, `docs-get-content`, `docs-list-tabs` |
|  | **Editing**: `docs-insert-text`, `docs-delete-range`, `docs-replace-text`, `docs-batch-update` |
|  | **Formatting**: `docs-format-text`, `docs-format-paragraph` |
|  | **Elements**: `docs-insert-table`, `docs-insert-image`, `docs-insert-page-break` |
| `shared-drives.ts` | `list-shared-drives`, `get-shared-drive`, `create-shared-drive` (GWS) |
| `labels.ts` | `list-file-labels`, `apply-label`, `remove-label` (GWS) |
| `approvals.ts` | `list-approvals`, `get-approval` (GWS) |
| `slides.ts` | **Presentation**: `slides-get-presentation`, `slides-create-presentation`, `slides-duplicate-presentation` |
|  | **Slide Management**: `slides-get-slide`, `slides-add-slide`, `slides-delete-slide`, `slides-move-slide`, `slides-duplicate-slide` |
|  | **Content**: `slides-insert-text`, `slides-replace-text`, `slides-insert-text-box`, `slides-insert-image`, `slides-insert-table`, `slides-update-table-cell`, `slides-insert-shape` |
|  | **Formatting**: `slides-format-text`, `slides-format-shape`, `slides-resize-element`, `slides-set-slide-background`, `slides-batch-update` |

## 최근 변경사항 (2026-04-20)

- **v1.3.0**: Google Docs API v1 지원 추가 — 13개 도구 (문서 관리, 콘텐츠 편집, 서식, 테이블/이미지/페이지 브레이크 삽입, 멀티탭 지원)
- **v1.2.0**: Google Slides API v1 지원 추가 — 20개 도구 (프레젠테이션 관리, 슬라이드 편집, 콘텐츠 삽입, 서식)
- **v1.1.1**: Windows ADC 경로 지원 — `%APPDATA%\gcloud\` 경로 인식 추가 (기존 Unix 경로만 지원)

## Known Limitations

- Approvals API: `googleapis` SDK has no typed bindings yet — uses raw `fetch` with auth header extraction
- `search-files`: Auto-wraps plain text queries in `fullText contains '...'`; pass Drive query syntax directly for advanced searches

## 최근 변경사항

- **v1.11.2** (2026-05-03): `@us-all/mcp-toolkit ^1.0.0` 핀 업데이트. toolkit API freeze (semver 1.x 보장 시작) — 코드 변경 0줄, 74/74 테스트 통과.
- **v1.11.1** (2026-05-03): Wave 5 default-projection 정렬 — `sheets-get-spreadsheet`에 rowCount/columnCount/locale/timeZone 포함, `docs-get-document`에 tabsCount + tabs.*.tabId/title 포함, `list-files`에 get-file와 동일한 slim default 적용 (capabilities/contentRestrictions 드롭, ~80% 사이즈 감소).
- **v1.11.0** (2026-05-02): `summarize-spreadsheet` 어그리게이션 — metadata + per-tab sample + named ranges 1 call. A1 quote-doubling으로 한글 시트명 안전 처리.
- **v1.10.0** (2026-05-02): Wave 3 Resources — `gdrive://shared-drive/{driveId}` (GWS-gated), `gdrive://about/me`.
- **v1.9.0** (2026-05-02): MCP Prompts 4개 — `audit-shared-drive-permissions`, `cleanup-shared-with-me`, `analyze-doc-structure`, `bulk-format-spreadsheet`.
- **v1.8.2** (2026-05-02): Wave 1 — describe trim 19, 의존성 bumps, fat-read 3개에 default extractFields.
- **v1.8.1** (2026-05-02): `@us-all/mcp-toolkit ^0.2.0` 채택 — 로컬 `sanitize` / `wrapToolHandler` 본문 제거, `createWrapToolHandler` factory로 위임. `redactionPatterns`(Google query-string `key=...`) + `errorExtractors`(WriteBlockedError·GWSFeatureError → passthrough, Google API errors → structured)만 명시.
- **v1.8.0** (2026-05-01): `@us-all/mcp-toolkit ^0.1.0` 마이그레이션 — tool-registry/extract-fields toolkit 위임. ~66 lines 절감.
- **v1.7.1**: 추가 MCP Resources (`gdrive://folder/{folderId}`).
- **v1.7.0**: `summarize-doc` 어그리게이션 도구 — file + content + permissions + comments 1 call.
- **v1.6.0**: MCP Resources (`gdrive://` URI) — file, spreadsheet, document, presentation.
- **v1.5.2**: `pnpm token-stats` + CI TOKEN_BUDGET=22000.
- **v1.5.1**: `extractFields` auto-apply via wrapToolHandler. search/sheets/docs/slides 핵심 read 스키마에 명시적 선언.
- **v1.5.0**: 토큰 효율 표준 (GD_TOOLS / GD_DISABLE 7 카테고리 + search-tools 메타툴 + extractFields).
- **v1.4.1**: hono >=4.12.14 보안 패치.
- **v1.4.0**: `googleapis` 148→171, `google-auth-library` v9→v10. 코드 변경 0줄, 66 unit tests pass.

## 표준 가이드

`@us-all` MCP 작성 표준은 [mcp-toolkit/STANDARD.md](https://github.com/us-all/mcp-toolkit/blob/main/STANDARD.md)에 있음.
