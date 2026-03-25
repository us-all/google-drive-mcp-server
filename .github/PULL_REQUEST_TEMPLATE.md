## Summary

<!-- Brief description of what this PR does -->

## Changes

-

## Test Plan

- [ ] `pnpm run build` passes
- [ ] `pnpm run test` passes
- [ ] Tested with Claude Desktop / Claude Code (if applicable)

## Checklist

- [ ] All schema fields have `.describe()`
- [ ] Write operations are guarded with `assertWriteAllowed()`
- [ ] GWS-only features are guarded with `requireGWS()`
- [ ] `supportsAllDrives: true` is passed to all Drive API calls
