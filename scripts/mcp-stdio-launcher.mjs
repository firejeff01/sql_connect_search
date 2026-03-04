#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const devEntrypoint = resolve(projectRoot, "src", "index.ts");
const distEntrypoint = resolve(projectRoot, "dist", "src", "index.js");
const useDistEntrypoint = process.env.SQL_CONNECT_SEARCH_DEV !== "1";
const entryArgs = useDistEntrypoint
  ? [distEntrypoint, ...process.argv.slice(2)]
  : ["--experimental-strip-types", devEntrypoint, ...process.argv.slice(2)];

const child = spawn(process.execPath, entryArgs, {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const event of ["SIGINT", "SIGTERM"]) {
  process.on(event, () => {
    child.kill(event);
  });
}
