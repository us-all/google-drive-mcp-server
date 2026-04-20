/**
 * Smoke test for Google Drive MCP Server.
 *
 * Spawns the MCP server as a child process, sends JSON-RPC 2.0 messages
 * over stdin, reads responses from stdout, and verifies basic tool
 * functionality against a live Google Drive API.
 *
 * Requires valid Google credentials (OAuth2, Service Account, or ADC).
 *
 * Usage:
 *   node scripts/smoke-test.mjs
 *   pnpm run smoke          # builds first via presmoke
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const SERVER_BIN = resolve(PROJECT_ROOT, "dist/index.js");

const TIMEOUT_MS = 30_000;
const EXPECTED_TOOL_COUNT = 95;

// ── Helpers ──────────────────────────────────────────────────────────────────

let nextId = 1;

function makeRequest(method, params = {}) {
  return {
    jsonrpc: "2.0",
    id: nextId++,
    method,
    params,
  };
}

function truncate(str, maxLen = 80) {
  if (typeof str !== "string") str = JSON.stringify(str);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

// ── Server process management ────────────────────────────────────────────────

function startServer() {
  const child = spawn("node", [SERVER_BIN], {
    cwd: PROJECT_ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  let buffer = "";
  const pending = new Map(); // id -> { resolve, reject }

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();

    // MCP stdio transport: each message is a single JSON line
    let newlineIdx;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      if (!line) continue;

      try {
        const msg = JSON.parse(line);

        // Responses have an id; notifications do not
        if (msg.id != null && pending.has(msg.id)) {
          const { resolve } = pending.get(msg.id);
          pending.delete(msg.id);
          resolve(msg);
        }
      } catch {
        // Ignore non-JSON lines (server may log to stdout in edge cases)
      }
    }
  });

  child.stderr.on("data", () => {
    // Swallow server stderr (startup logs, etc.)
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const req = makeRequest(method, params);
      pending.set(req.id, { resolve, reject });
      child.stdin.write(JSON.stringify(req) + "\n");
    });
  }

  function kill() {
    child.stdin.end();
    child.kill("SIGTERM");
  }

  return { send, kill, child };
}

// ── Test definitions ─────────────────────────────────────────────────────────

const tests = [
  {
    name: "initialize",
    run: async (send) => {
      const res = await send("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "smoke-test", version: "1.0.0" },
      });
      if (res.error) throw new Error(res.error.message);
      const serverName = res.result?.serverInfo?.name;
      if (!serverName) throw new Error("Missing serverInfo.name");
      // Send initialized notification (fire-and-forget, no id)
      return `server: ${serverName} v${res.result.serverInfo.version}`;
    },
  },
  {
    name: "tools/list",
    run: async (send) => {
      const res = await send("tools/list", {});
      if (res.error) throw new Error(res.error.message);
      const count = res.result?.tools?.length ?? 0;
      if (count !== EXPECTED_TOOL_COUNT) {
        throw new Error(`Expected ${EXPECTED_TOOL_COUNT} tools, got ${count}`);
      }
      return `${count} tools registered`;
    },
  },
  {
    name: "get-about",
    run: async (send) => {
      const res = await send("tools/call", {
        name: "get-about",
        arguments: {},
      });
      if (res.error) throw new Error(res.error.message);
      const text = res.result?.content?.[0]?.text ?? "";
      if (res.result?.isError) throw new Error(truncate(text));
      if (!text) throw new Error("Empty response");
      // Try to extract user email from the response
      const emailMatch = text.match(/[\w.-]+@[\w.-]+/);
      return emailMatch ? `user: ${emailMatch[0]}` : "user info returned";
    },
  },
  {
    name: "list-files",
    run: async (send) => {
      const res = await send("tools/call", {
        name: "list-files",
        arguments: {},
      });
      if (res.error) throw new Error(res.error.message);
      const text = res.result?.content?.[0]?.text ?? "";
      if (res.result?.isError) throw new Error(truncate(text));
      if (!text) throw new Error("Empty response");
      return truncate(text, 60);
    },
  },
  {
    name: "search-files",
    run: async (send) => {
      const res = await send("tools/call", {
        name: "search-files",
        arguments: { query: "test" },
      });
      if (res.error) throw new Error(res.error.message);
      const text = res.result?.content?.[0]?.text ?? "";
      if (res.result?.isError) throw new Error(truncate(text));
      return truncate(text, 60);
    },
  },
  {
    name: "get-folder-tree",
    run: async (send) => {
      const res = await send("tools/call", {
        name: "get-folder-tree",
        arguments: { folderId: "root", depth: 1 },
      });
      if (res.error) throw new Error(res.error.message);
      const text = res.result?.content?.[0]?.text ?? "";
      if (res.result?.isError) throw new Error(truncate(text));
      return truncate(text, 60);
    },
  },
  {
    name: "list-shared-drives",
    run: async (send) => {
      const res = await send("tools/call", {
        name: "list-shared-drives",
        arguments: {},
      });
      if (res.error) throw new Error(res.error.message);
      const text = res.result?.content?.[0]?.text ?? "";
      // GWS-only tool may return an error for personal accounts — that is acceptable
      if (res.result?.isError && /GWS|Workspace|not available/i.test(text)) {
        return "skipped (personal account)";
      }
      if (res.result?.isError) throw new Error(truncate(text));
      return truncate(text, 60);
    },
  },
  {
    name: "get-activity",
    run: async (send) => {
      const res = await send("tools/call", {
        name: "get-activity",
        arguments: { pageSize: 1 },
      });
      if (res.error) throw new Error(res.error.message);
      const text = res.result?.content?.[0]?.text ?? "";
      if (res.result?.isError) throw new Error(truncate(text));
      return truncate(text, 60);
    },
  },
];

// ── Main runner ──────────────────────────────────────────────────────────────

async function main() {
  const { send, kill, child } = startServer();

  const results = []; // { name, status, summary }
  let allPassed = true;

  // Global timeout
  const timer = setTimeout(() => {
    console.error("\nSmoke test timed out after 30 seconds.");
    kill();
    process.exit(1);
  }, TIMEOUT_MS);

  // Ensure cleanup on unexpected exit
  child.on("exit", (code) => {
    if (results.length < tests.length) {
      console.error(`Server exited unexpectedly with code ${code}`);
      clearTimeout(timer);
      process.exit(1);
    }
  });

  try {
    for (const test of tests) {
      try {
        const summary = await test.run(send);
        results.push({ name: test.name, status: "PASS", summary });
      } catch (err) {
        results.push({ name: test.name, status: "FAIL", summary: err.message });
        allPassed = false;
      }

      // After initialize, send the initialized notification
      if (test.name === "initialize") {
        child.stdin.write(
          JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n"
        );
      }
    }
  } finally {
    clearTimeout(timer);
    kill();
  }

  // ── Print results table ──────────────────────────────────────────────────

  console.log("\n" + "=".repeat(90));
  console.log("  Google Drive MCP Server — Smoke Test Results");
  console.log("=".repeat(90));

  const nameWidth = 22;
  const statusWidth = 8;
  const summaryWidth = 54;

  console.log(
    "  " +
      "Tool".padEnd(nameWidth) +
      "Status".padEnd(statusWidth) +
      "Summary"
  );
  console.log("  " + "-".repeat(nameWidth + statusWidth + summaryWidth));

  for (const r of results) {
    const statusTag = r.status === "PASS" ? "PASS" : "FAIL";
    console.log(
      "  " +
        r.name.padEnd(nameWidth) +
        statusTag.padEnd(statusWidth) +
        truncate(r.summary, summaryWidth)
    );
  }

  console.log("  " + "-".repeat(nameWidth + statusWidth + summaryWidth));

  const passed = results.filter((r) => r.status === "PASS").length;
  console.log(`\n  ${passed}/${results.length} tests passed.\n`);

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test runner error:", err);
  process.exit(1);
});
