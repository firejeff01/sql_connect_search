import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const entrypoint = resolve(projectRoot, "src", "index.ts");

const child = spawn(process.execPath, ["--experimental-strip-types", entrypoint, ...process.argv.slice(2)], {
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
