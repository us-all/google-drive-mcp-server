# Contributing

## Setup

```bash
git clone https://github.com/us-all/google-drive-mcp-server.git
cd google-drive-mcp-server
pnpm install
pnpm run build
```

## Development

```bash
pnpm run dev       # Watch mode (auto-rebuild on changes)
pnpm run test      # Run tests
pnpm run test:watch # Watch tests
```

## Adding a New Tool

All tools follow a 3-part pattern:

### 1. Schema (Zod)

```typescript
export const myToolSchema = z.object({
  fileId: z.string().describe("The ID of the file"),
  limit: z.coerce.number().optional().default(20).describe("Max results (1-100). Default: 20"),
});
```

Rules:
- Every field **must** have `.describe()` — this is what the AI model sees
- Use `z.coerce.number()` for numeric parameters (MCP sends strings)
- Provide sensible `.default()` values

### 2. Handler

```typescript
export async function myTool(params: z.infer<typeof myToolSchema>) {
  // For write operations:
  assertWriteAllowed();

  // For GWS-only features:
  const caps = getCapabilities();
  if (caps) requireGWS(caps, "Feature Name");

  const drive = getDriveClient();
  const response = await drive.files.list({ ... });
  return { /* transformed response */ };
}
```

Rules:
- Always pass `supportsAllDrives: true` to Drive API calls
- Transform responses to return only useful fields
- Guard write operations with `assertWriteAllowed()`
- Guard GWS features with `requireGWS()`

### 3. Registration (in index.ts)

```typescript
server.tool(
  "my-tool",
  "Description of what the tool does. Mention GWS requirement with [GWS] prefix if applicable",
  myToolSchema.shape,
  wrapToolHandler(myTool),
);
```

## Project Structure

```
src/
├── index.ts          # Server entry point, tool registration
├── config.ts         # Environment variable loading
├── client.ts         # Google API client initialization
├── capabilities.ts   # Personal vs GWS detection
└── tools/
    ├── utils.ts      # Error handling, write guard, GWS guard
    ├── files.ts      # File CRUD
    ├── search.ts     # File/drive search
    ├── folders.ts    # Folder operations
    ├── permissions.ts # Sharing/permissions
    ├── export.ts     # File export
    ├── comments.ts   # Comments
    ├── revisions.ts  # Revision history
    ├── about.ts      # Account info
    ├── activity.ts   # Drive activity
    ├── shared-drives.ts # [GWS] Shared Drives
    ├── labels.ts     # [GWS] Labels
    └── approvals.ts  # [GWS] Approvals
```

## Testing

```bash
pnpm run test         # Unit tests
pnpm run smoke        # Live API smoke test (requires credentials)
```
