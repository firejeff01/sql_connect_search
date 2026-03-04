import { resolve } from "node:path";
import { MCPServer } from "../src/server/MCPServer.ts";

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

async function main(): Promise<void> {
  process.env.MYSQL_LIVE_PASSWORD = readEnv("MYSQL_LIVE_PASSWORD");

  const configPath = resolve(process.env.MYSQL_LIVE_CONFIG ?? "config/shop-mysql.yaml");

  const server = new MCPServer();
  await server.start({ configPath });
  const initialize = await server.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {}
  });
  const toolsList = await server.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  });
  const connections = await server.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "list_connections",
      arguments: {},
      client: "mysql-live-demo"
    }
  });
  const schemaOverview = await server.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "discover_schema",
      arguments: {
        connection_name: "shop-mysql",
        depth: 1
      },
      client: "mysql-live-demo"
    }
  });

  const discoveredTableName =
    process.env.MYSQL_LIVE_TABLE ??
    (
      "result" in schemaOverview &&
      Array.isArray((schemaOverview.result as any).content) &&
      (schemaOverview.result as any).content[0]?.json?.tables?.[0]?.name
    ) ??
    "shop_cart";

  const query = process.env.MYSQL_LIVE_QUERY ?? `SELECT * FROM \`${discoveredTableName}\` LIMIT 5`;

  const tableDescription = await server.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "describe_tables",
      arguments: {
        connection_name: "shop-mysql",
        table_name: discoveredTableName
      },
      client: "mysql-live-demo"
    }
  });
  const queryResult = await server.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "query_database",
      arguments: {
        connection_name: "shop-mysql",
        query
      },
      client: "mysql-live-demo"
    }
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        status: server.getStatus(),
        transport: server.getTransportType(),
        selectedTable: discoveredTableName,
        initialize,
        toolsList,
        connections,
        tableDescription,
        queryResult,
        schemaOverview
      },
      null,
      2
    )}\n`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
