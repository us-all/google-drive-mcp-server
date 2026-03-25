# Changelog

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
