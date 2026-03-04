import { resolve } from "node:path";
import { MCPServer } from "../src/server/MCPServer.ts";

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

async function postJson(url: string, body: unknown, apiKey: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  return response.json();
}

async function main(): Promise<void> {
  process.env.MYSQL_LIVE_PASSWORD = readEnv("MYSQL_LIVE_PASSWORD");

  const configPath = resolve(process.env.MYSQL_LIVE_HTTP_CONFIG ?? "config/shop-mysql-http.yaml");
  const apiKey = process.env.MYSQL_HTTP_API_KEY ?? "shop-demo-key";
  const port = Number(process.env.MYSQL_HTTP_PORT ?? 3100);
  const baseUrl = `http://127.0.0.1:${port}`;

  const server = new MCPServer();
  await server.start({ configPath, http: true, port, bind: "127.0.0.1" });

  try {
    const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
    const initialize = await postJson(
      `${baseUrl}/mcp`,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {}
      },
      apiKey
    );
    const toolsList = await postJson(
      `${baseUrl}/mcp`,
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {}
      },
      apiKey
    );
    const schemaOverview = await postJson(
      `${baseUrl}/mcp`,
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "discover_schema",
          arguments: {
            connection_name: "shop-mysql",
            depth: 1
          },
          client: "mysql-http-demo"
        }
      },
      apiKey
    );

    const discoveredTableName =
      process.env.MYSQL_LIVE_TABLE ??
      ((schemaOverview as any).result?.content?.[0]?.json?.tables?.[0]?.name as string | undefined) ??
      "shop_cart";

    const query = process.env.MYSQL_LIVE_QUERY ?? `SELECT * FROM \`${discoveredTableName}\` LIMIT 5`;

    const tableDescription = await postJson(
      `${baseUrl}/mcp`,
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "describe_tables",
          arguments: {
            connection_name: "shop-mysql",
            table_name: discoveredTableName
          },
          client: "mysql-http-demo"
        }
      },
      apiKey
    );
    const queryResult = await postJson(
      `${baseUrl}/mcp`,
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "query_database",
          arguments: {
            connection_name: "shop-mysql",
            query
          },
          client: "mysql-http-demo"
        }
      },
      apiKey
    );

    process.stdout.write(
      `${JSON.stringify(
        {
          status: server.getStatus(),
          transport: server.getTransportType(),
          baseUrl,
          health,
          initialize,
          toolsList,
          selectedTable: discoveredTableName,
          schemaOverview,
          tableDescription,
          queryResult
        },
        null,
        2
      )}\n`
    );
  } finally {
    await server.stop();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
