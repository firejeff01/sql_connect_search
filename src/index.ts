import { resolve } from "node:path";
import { configFileExists, getDefaultConfigPath, writeStarterConfig } from "./config/DefaultConfigPaths.ts";
import { MCPServer } from "./server/MCPServer.ts";

type CommandName = "serve" | "init" | "config-path";

function parseArgs(argv: string[]): {
  command: CommandName;
  http: boolean;
  port?: number;
  bind?: string;
  configPath: string;
  force: boolean;
} {
  const result: {
    command: CommandName;
    http: boolean;
    port?: number;
    bind?: string;
    configPath: string;
    force: boolean;
  } = {
    command: "serve",
    http: false,
    configPath: getDefaultConfigPath(),
    force: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "init") {
      result.command = "init";
    } else if (arg === "config-path") {
      result.command = "config-path";
    } else if (arg === "--http") {
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
    } else if (arg === "--force") {
      result.force = true;
    }
  }

  return result;
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "config-path") {
    process.stdout.write(`${args.configPath}\n`);
    return;
  }

  if (args.command === "init") {
    const status = await writeStarterConfig(args.configPath, args.force);
    process.stdout.write(
      `${JSON.stringify({
        status,
        configPath: args.configPath,
        nextSteps: [
          "Edit the generated config file with your database host, database name, and username.",
          "Set MYSQL_LIVE_PASSWORD in your shell or client environment before starting the MCP server.",
          "Start the server with sql-connect-search-mcp or register it in your MCP client."
        ]
      })}\n`
    );
    return;
  }

  if (!(await configFileExists(args.configPath))) {
    throw new Error(
      `Config file was not found at '${args.configPath}'. Run 'sql-connect-search-mcp init' to create a starter config, or pass --config <path>.`
    );
  }

  const server = new MCPServer();
  await server.start(args);
  if (server.getTransportType() === "stdio") {
    await server.runStdioLoop();
    return;
  }

  process.stdout.write(
    `${JSON.stringify({
      status: server.getStatus(),
      transport: server.getTransportType(),
      port: server.getPort(),
      bind: server.getBindAddress()
    })}\n`
  );
}

run()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
