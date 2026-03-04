import { resolve } from "node:path";
import { MCPServer } from "./server/MCPServer.ts";

function parseArgs(argv: string[]): { http: boolean; port?: number; bind?: string; configPath: string } {
  const result: { http: boolean; port?: number; bind?: string; configPath: string } = {
    http: false,
    configPath: resolve("config/default.yaml")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--http") {
      result.http = true;
    } else if (arg === "--port") {
      result.port = Number(argv[index + 1]);
      index += 1;
    } else if (arg === "--bind") {
      result.bind = argv[index + 1];
      index += 1;
    } else if (arg === "--config") {
      result.configPath = resolve(argv[index + 1]);
      index += 1;
    }
  }

  return result;
}

const server = new MCPServer();
const args = parseArgs(process.argv.slice(2));

server
  .start(args)
  .then(() => {
    if (server.getTransportType() === "stdio") {
      return server.runStdioLoop();
    }
    process.stdout.write(
      `${JSON.stringify({
        status: server.getStatus(),
        transport: server.getTransportType(),
        port: server.getPort(),
        bind: server.getBindAddress()
      })}\n`
    );
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
