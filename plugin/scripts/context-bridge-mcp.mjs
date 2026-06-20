#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const server = resolve(here, "..", "..", "dist", "index.js");

if (!existsSync(server)) {
  console.error(`Context Bridge MCP server is not built at ${server}. Run npm install && npm run build in the package root.`);
  process.exit(1);
}

const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: {
    ...process.env,
    CONTEXT_BRIDGE_TRANSPORT: process.env.CONTEXT_BRIDGE_TRANSPORT ?? "stdio"
  }
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
