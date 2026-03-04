import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigLoader } from "../src/config/ConfigLoader.ts";
import { ConnectionManager } from "../src/database/pool/ConnectionManager.ts";
import { AuditLogger } from "../src/audit/AuditLogger.ts";
import { SQLValidator } from "../src/security/SQLValidator.ts";
import { QueryPolicy } from "../src/security/QueryPolicy.ts";
import { ToolRegistry } from "../src/tools/ToolRegistry.ts";
import { ListConnectionsTool } from "../src/tools/ListConnectionsTool.ts";
import { QueryDatabaseTool } from "../src/tools/QueryDatabaseTool.ts";
import { MCPServer } from "../src/server/MCPServer.ts";

test("ConfigLoader resolves env credentials from config/default style JSON-yaml", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sql-connect-search-"));
  await writeFile(join(dir, ".env"), "MSSQL_PASSWORD=secret123\n", "utf8");
  await writeFile(
    join(dir, "config.yaml"),
    JSON.stringify({
      connections: [
        {
          name: "sales-db",
          type: "mssql",
          host: "127.0.0.1",
          port: 1433,
          database: "sales",
          username: "readonly",
          passwordRef: "${MSSQL_PASSWORD}"
        }
      ],
      pool: { max: 10, min: 2, idleTimeout: 30000 },
      limits: { max_rows: 1000, timeout: 30, result_size: 5, max_execution_time: 60 },
      audit: { enabled: true },
      credential: { provider: "env" }
    }),
    "utf8"
  );

  const loader = new ConfigLoader();
  const config = await loader.loadConfig(join(dir, "config.yaml"));
  assert.equal(config.connections[0].password, "secret123");
});

test("SQLValidator allows read-only statements and rejects mutations", () => {
  const validator = new SQLValidator();
  assert.equal(validator.validate("SELECT * FROM orders").valid, true);
  assert.equal(validator.validate("DROP TABLE orders").valid, false);
  assert.equal(validator.validate("SELECT * FROM orders; DELETE FROM orders").valid, false);
});

test("ConnectionManager resolves names and aliases", async () => {
  const manager = new ConnectionManager(
    { max_rows: 1000, timeout: 30, result_size: 5, max_execution_time: 60 },
    "sales-db"
  );
  await manager.createPools(
    [
      {
        name: "sales-db",
        type: "mssql",
        host: "127.0.0.1",
        port: 1433,
        database: "sales",
        username: "readonly",
        aliases: ["prod_sales_ro"]
      }
    ],
    { max: 10, min: 2, idleTimeout: 30000 }
  );

  assert.equal(manager.resolveConnectionName(), "sales-db");
  assert.equal(manager.resolveConnectionName("prod_sales_ro"), "sales-db");
  assert.equal(manager.listConnections().length, 1);
});

test("QueryDatabaseTool clamps limits and writes audit logs", async () => {
  const limits = { max_rows: 1, timeout: 30, result_size: 5, max_execution_time: 60 };
  const manager = new ConnectionManager(limits, "sales-db");
  await manager.createPools(
    [
      {
        name: "sales-db",
        type: "mssql",
        host: "127.0.0.1",
        port: 1433,
        database: "sales",
        username: "readonly"
      }
    ],
    { max: 10, min: 2, idleTimeout: 30000 }
  );
  const logger = new AuditLogger({ enabled: true }, process.stdout);
  const tool = new QueryDatabaseTool(manager, new SQLValidator(), logger, limits);
  const result = await tool.execute(
    {
      query: "SELECT * FROM orders",
      limit: 100
    },
    { client: "unit-test" }
  );

  assert.equal(result.rowCount, 1);
  assert.equal(result.truncated, true);
  assert.equal(logger.getEntries().length, 1);
  const applied = QueryPolicy.clampLimits({ limit: 100, timeout_ms: 60000 }, limits);
  assert.equal(applied.limit, 1);
  assert.equal(applied.timeoutMs, 30000);
});

test("ToolRegistry registers tools", async () => {
  const manager = new ConnectionManager(
    { max_rows: 1000, timeout: 30, result_size: 5, max_execution_time: 60 },
    "sales-db"
  );
  await manager.createPools(
    [
      {
        name: "sales-db",
        type: "mssql",
        host: "127.0.0.1",
        port: 1433,
        database: "sales",
        username: "readonly"
      }
    ],
    { max: 10, min: 2, idleTimeout: 30000 }
  );
  const registry = new ToolRegistry();
  registry.registerTools([new ListConnectionsTool(manager)]);
  assert.equal(registry.getRegisteredTools().length, 1);
});

test("MCPServer starts in stdio and http modes", async () => {
  process.env.MSSQL_PASSWORD = "secret123";
  process.env.MONGO_PASSWORD = "secret456";

  const stdioServer = new MCPServer();
  await stdioServer.start({ configPath: join(process.cwd(), "config/default.yaml") });
  assert.equal(stdioServer.getStatus(), "running");
  assert.equal(stdioServer.getTransportType(), "stdio");
  assert.equal(stdioServer.getToolRegistry().getRegisteredTools().length, 5);

  const httpServer = new MCPServer();
  await httpServer.start({
    configPath: join(process.cwd(), "config/default.yaml"),
    http: true,
    port: 3000,
    bind: "0.0.0.0"
  });
  assert.equal(httpServer.getTransportType(), "http");
  assert.equal(httpServer.getPort(), 3000);
  assert.equal(httpServer.getBindAddress(), "0.0.0.0");
});
