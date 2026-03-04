import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuditLogger } from "../src/audit/AuditLogger.ts";
import { ConfigLoader } from "../src/config/ConfigLoader.ts";
import { ConnectionManager } from "../src/database/pool/ConnectionManager.ts";
import { SchemaCache } from "../src/schema/SchemaCache.ts";
import { MCPServer } from "../src/server/MCPServer.ts";
import { QueryPolicy } from "../src/security/QueryPolicy.ts";
import { SQLValidator } from "../src/security/SQLValidator.ts";
import { ListConnectionsTool } from "../src/tools/ListConnectionsTool.ts";
import { QueryDatabaseTool } from "../src/tools/QueryDatabaseTool.ts";
import { ToolRegistry } from "../src/tools/ToolRegistry.ts";
import { MySQLDriver } from "../src/database/drivers/MySQLDriver.ts";
import { getRegisteredSteps } from "../sa/StepDefinitions/support/mini-cucumber.ts";
import { runFeatureFile } from "../sa/StepDefinitions/support/feature-runner.ts";
import "../sa/StepDefinitions/CommonSteps.ts";
import "../sa/StepDefinitions/AuditLogSteps.ts";
import "../sa/StepDefinitions/ConnectionManagementSteps.ts";
import "../sa/StepDefinitions/CredentialManagementSteps.ts";
import "../sa/StepDefinitions/HTTPAuthenticationSteps.ts";
import "../sa/StepDefinitions/MongoDBSecuritySteps.ts";
import "../sa/StepDefinitions/MultiDatabaseDriverSteps.ts";
import "../sa/StepDefinitions/SchemaDiscoverySteps.ts";
import "../sa/StepDefinitions/ServerStartupSteps.ts";
import "../sa/StepDefinitions/SQLQueryExecutionSteps.ts";
import "../sa/StepDefinitions/SQLSecuritySteps.ts";

async function testConfigLoader(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "sql-connect-search-"));
  await writeFile(join(dir, ".env"), "MSSQL_PASSWORD=secret123\n", "utf8");
  await writeFile(
    join(dir, "config.yaml"),
    `
connections:
  - name: sales-db
    type: mssql
    host: 127.0.0.1
    port: 1433
    database: sales
    username: readonly
    passwordRef: \${MSSQL_PASSWORD}
pool:
  max: 10
  min: 2
  idleTimeout: 30000
limits:
  max_rows: 1000
  timeout: 30
  result_size: 5
  max_execution_time: 60
audit:
  enabled: true
credential:
  provider: env
`.trim(),
    "utf8"
  );

  const loader = new ConfigLoader();
  const config = await loader.loadConfig(join(dir, "config.yaml"));
  assert.equal(config.connections[0].password, "secret123");
}

function testSqlValidator(): void {
  const validator = new SQLValidator();
  assert.equal(validator.validate("SELECT * FROM orders").valid, true);
  assert.equal(validator.validate("DROP TABLE orders").valid, false);
  assert.equal(validator.validate("SELECT * FROM orders; DELETE FROM orders").valid, false);
}

async function testConnectionManager(): Promise<void> {
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
}

async function testLauncherCommand(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "sql-connect-search-launcher-"));
  const configPath = join(dir, "config.yaml");
  await writeFile(
    configPath,
    `
connections:
  - name: sales-db
    type: mssql
    host: 127.0.0.1
    port: 1433
    database: sales
    username: readonly
pool:
  max: 10
  min: 2
  idleTimeout: 30000
limits:
  max_rows: 1000
  timeout: 30
  result_size: 5
  max_execution_time: 60
audit:
  enabled: true
credential:
  provider: env
`.trim(),
    "utf8"
  );

  try {
    await new Promise<void>((resolvePromise, rejectPromise) => {
      const child = spawn(process.execPath, ["scripts/mcp-stdio-launcher.mjs", "--config", configPath], {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env
      });

      let stdout = "";
      let stderr = "";

      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        rejectPromise(new Error(`Launcher timed out. stdout=${stdout} stderr=${stderr}`));
      }, 5000);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");

      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
        const line = stdout.split(/\r?\n/).find((item) => item.trim().length > 0);
        if (!line) {
          return;
        }

        clearTimeout(timeout);
        child.kill("SIGTERM");

        try {
          const response = JSON.parse(line) as {
            jsonrpc: string;
            id: number;
            result?: { protocolVersion?: string };
          };
          assert.equal(response.jsonrpc, "2.0");
          assert.equal(response.id, 1);
          assert.equal(typeof response.result?.protocolVersion, "string");
          resolvePromise();
        } catch (error: unknown) {
          rejectPromise(error);
        }
      });

      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });

      child.on("error", (error: Error) => {
        clearTimeout(timeout);
        rejectPromise(error);
      });

      child.on("exit", (code, signal) => {
        if (signal === "SIGTERM" || code === 0) {
          return;
        }
        clearTimeout(timeout);
        rejectPromise(new Error(`Launcher exited unexpectedly. code=${code} stderr=${stderr}`));
      });

      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`);
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("spawn EPERM")) {
      process.stdout.write("Launcher smoke test skipped\n");
      return;
    }
    throw error;
  }
}

async function testSchemaCachePersistence(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "sql-connect-search-schema-cache-"));
  const key = JSON.stringify({ connection_name: "sales-db", depth: 1 });
  const value = {
    database: "sales",
    tables: [
      {
        name: "orders",
        columns: [{ name: "id", type: "int" }]
      }
    ],
    truncated: false
  };

  const first = new SchemaCache(10 * 60 * 1000, dir);
  await first.set(key, value);

  const second = new SchemaCache(10 * 60 * 1000, dir);
  const loaded = await second.get(key);
  assert.deepEqual(loaded, value);
}

async function testQueryTool(): Promise<void> {
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
}

async function testRegistryAndServer(): Promise<void> {
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

  process.env.MSSQL_PASSWORD = "secret123";
  process.env.MONGO_PASSWORD = "secret456";

  const stdioServer = new MCPServer();
  await stdioServer.start({ configPath: join(process.cwd(), "config/default.yaml") });
  assert.equal(stdioServer.getStatus(), "running");
  assert.equal(stdioServer.getTransportType(), "stdio");
  assert.equal(stdioServer.getToolRegistry().getRegisteredTools().length, 5);
  const initializeResponse = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2026-03-05",
      clientInfo: {
        name: "Claude Desktop",
        version: "1.2.3"
      },
      capabilities: {
        resources: {
          read: true
        },
        roots: {
          listChanged: true
        },
        sampling: {
          createMessage: true
        }
      }
    }
  });
  assert.equal("result" in initializeResponse, true);
  if ("result" in initializeResponse) {
    const result = initializeResponse.result as {
      protocolVersion: string;
      capabilities: {
        logging?: Record<string, never>;
        resources: { subscribe: boolean };
        prompts: { listChanged: boolean };
      };
      instructions: string;
      _meta?: {
        acceptedProtocolVersion?: string;
        acknowledgedClientInfo?: { name?: string; version?: string };
        acknowledgedClientCapabilities?: {
          resources?: { read?: boolean };
          roots?: { listChanged?: boolean };
          sampling?: { createMessage?: boolean };
        };
        compatibilityProfile?: { hostKind: string; notes: string[] };
        negotiatedCapabilities?: {
          ping: boolean;
          notifications: { initialized: boolean };
          resources: { read: boolean };
          roots: { listChanged: boolean };
          sampling: { createMessage: boolean };
        };
      };
    };
    assert.equal(result.protocolVersion, "2026-03-05");
    assert.ok(result.capabilities.logging);
    assert.equal(result.capabilities.resources.subscribe, false);
    assert.equal(result.capabilities.prompts.listChanged, false);
    assert.equal(result._meta?.acceptedProtocolVersion, "2026-03-05");
    assert.equal(result._meta?.acknowledgedClientInfo?.name, "Claude Desktop");
    assert.equal(result._meta?.acknowledgedClientCapabilities?.resources?.read, true);
    assert.equal(result._meta?.acknowledgedClientCapabilities?.sampling?.createMessage, true);
    assert.equal(result._meta?.compatibilityProfile?.hostKind, "claude_desktop");
    assert.equal((result._meta?.compatibilityProfile?.notes.length ?? 0) > 0, true);
    assert.equal(result._meta?.negotiatedCapabilities?.ping, true);
    assert.equal(result._meta?.negotiatedCapabilities?.notifications.initialized, true);
    assert.equal(result._meta?.negotiatedCapabilities?.resources.read, true);
    assert.equal(result._meta?.negotiatedCapabilities?.roots.listChanged, true);
    assert.equal(result._meta?.negotiatedCapabilities?.sampling.createMessage, false);
    assert.match(result.instructions, /read-only SQL/);
  }
  const pingResponse = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "ping",
    params: {}
  });
  assert.equal("result" in pingResponse, true);
  if ("result" in pingResponse) {
    assert.deepEqual(pingResponse.result, {});
  }
  const toolsListResponse = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/list",
    params: {}
  });
  assert.equal("result" in toolsListResponse, true);
  if ("result" in toolsListResponse) {
    const tools = (
      toolsListResponse.result as {
        tools: Array<{
          name: string;
          inputSchema: { properties: Record<string, unknown> };
          outputSchema: { type?: string };
        }>;
      }
    ).tools;
    const queryTool = tools.find((tool) => tool.name === "query_database");
    assert.ok(queryTool);
    assert.ok(queryTool.inputSchema.properties.query);
    assert.equal(queryTool.outputSchema.type, "object");
  }
  const toolsCallResponse = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "list_connections",
      arguments: {},
      client: "test-client"
    }
  });
  assert.equal("result" in toolsCallResponse, true);
  if ("result" in toolsCallResponse) {
    const result = toolsCallResponse.result as {
      toolName: string;
      metadata: { durationMs: number; generatedAt: string };
      content: Array<{ type: string; json: unknown }>;
    };
    assert.equal(result.toolName, "list_connections");
    assert.equal(typeof result.metadata.durationMs, "number");
    assert.equal(typeof result.metadata.generatedAt, "string");
    assert.equal(result.content[0].type, "json");
  }
  const resourcesListResponse = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 5,
    method: "resources/list",
    params: {}
  });
  assert.equal("result" in resourcesListResponse, true);
  if ("result" in resourcesListResponse) {
    const result = resourcesListResponse.result as {
      resources: Array<{
        uri: string;
        mimeType: string;
        annotations?: { origin?: string; cache?: { strategy: string; ttlMs?: number } };
      }>;
    };
    const schemaResource = result.resources.find((resource) => resource.uri === "schema://sales-db/overview");
    const templateResource = result.resources.find(
      (resource) => resource.uri === "template://query_database/select_top_rows"
    );
    assert.ok(schemaResource);
    assert.ok(templateResource);
    assert.equal(schemaResource.annotations?.origin, "root://connections/sales-db");
    assert.equal(schemaResource.annotations?.cache?.strategy, "persistent_ttl");
    assert.equal(typeof schemaResource.annotations?.cache?.ttlMs, "number");
    assert.equal(templateResource.annotations?.origin, "root://resources");
    assert.equal(templateResource.annotations?.cache?.strategy, "static");
  }
  const templateReadResponse = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 6,
    method: "resources/read",
    params: {
      uri: "template://query_database/select_top_rows"
    }
  });
  assert.equal("result" in templateReadResponse, true);
  if ("result" in templateReadResponse) {
    const result = templateReadResponse.result as {
      contents: Array<{
        uri: string;
        mimeType: string;
        text: string;
        metadata?: { origin?: string; root?: string; cacheStatus?: string };
      }>;
    };
    assert.equal(result.contents[0].uri, "template://query_database/select_top_rows");
    assert.equal(result.contents[0].mimeType, "application/json");
    assert.equal(result.contents[0].metadata?.origin, "root://resources");
    assert.equal(result.contents[0].metadata?.cacheStatus, "static");
    assert.match(result.contents[0].text, /query_database/);
  }
  const schemaReadResponse = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 7,
    method: "resources/read",
    params: {
      uri: "schema://sales-db/overview"
    }
  });
  assert.equal("result" in schemaReadResponse, true);
  if ("result" in schemaReadResponse) {
    const result = schemaReadResponse.result as {
      contents: Array<{
        uri: string;
        mimeType: string;
        text: string;
        metadata?: {
          origin?: string;
          root?: string;
          cacheStatus?: string;
          generatedAt?: string;
          expiresAt?: string;
        };
      }>;
    };
    assert.equal(result.contents[0].uri, "schema://sales-db/overview");
    assert.equal(result.contents[0].mimeType, "application/json");
    assert.equal(result.contents[0].metadata?.origin, "root://connections/sales-db");
    assert.equal(result.contents[0].metadata?.root, "root://connections/sales-db");
    assert.equal(typeof result.contents[0].metadata?.cacheStatus, "string");
    assert.equal(typeof result.contents[0].metadata?.generatedAt, "string");
    assert.equal(typeof result.contents[0].metadata?.expiresAt, "string");
    assert.match(result.contents[0].text, /"kind": "schema_overview"/);
  }
  const promptsListResponse = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 8,
    method: "prompts/list",
    params: {}
  });
  assert.equal("result" in promptsListResponse, true);
  if ("result" in promptsListResponse) {
    const result = promptsListResponse.result as {
      prompts: Array<{ name: string; arguments?: Array<{ name: string }> }>;
    };
    assert.equal(result.prompts.some((prompt) => prompt.name === "draft_safe_sql_query"), true);
  }
  const promptGetResponse = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 9,
    method: "prompts/get",
    params: {
      name: "draft_safe_sql_query",
      arguments: {
        connection_name: "sales-db",
        table_name: "orders",
        user_goal: "show the latest orders"
      }
    }
  });
  assert.equal("result" in promptGetResponse, true);
  if ("result" in promptGetResponse) {
    const result = promptGetResponse.result as {
      description: string;
      messages: Array<{ content: { text: string } }>;
    };
    assert.match(result.description, /read-only SQL/);
    assert.match(result.messages[0].content.text, /sales-db/);
    assert.match(result.messages[0].content.text, /orders/);
  }
  const rootsListResponse = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 10,
    method: "roots/list",
    params: {}
  });
  assert.equal("result" in rootsListResponse, true);
  if ("result" in rootsListResponse) {
    const result = rootsListResponse.result as {
      roots: Array<{
        uri: string;
        name: string;
        metadata?: {
          preferred?: boolean;
          kind?: string;
          connection?: { name: string; type: string; database: string };
          related?: { resources?: string[] };
        };
      }>;
    };
    const connectionsRoot = result.roots.find((root) => root.uri === "root://connections");
    const salesRoot = result.roots.find((root) => root.uri === "root://connections/sales-db");
    assert.ok(connectionsRoot);
    assert.ok(salesRoot);
    assert.equal(connectionsRoot.metadata?.preferred, true);
    assert.equal(connectionsRoot.metadata?.kind, "connections");
    assert.equal(salesRoot.metadata?.kind, "connection");
    assert.equal(salesRoot.metadata?.connection?.name, "sales-db");
    assert.equal(salesRoot.metadata?.connection?.type, "mssql");
    assert.equal(
      salesRoot.metadata?.related?.resources?.includes("schema://sales-db/overview"),
      true
    );
  }
  const invalidParamsResponse = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: {
      arguments: {}
    }
  });
  assert.equal("error" in invalidParamsResponse, true);
  if ("error" in invalidParamsResponse) {
    assert.equal(invalidParamsResponse.error.code, -32602);
    assert.equal(
      (invalidParamsResponse.error.data as { category: string }).category,
      "invalid_params"
    );
  }
  const toolNotFoundResponse = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 12,
    method: "tools/call",
    params: {
      name: "missing_tool",
      arguments: {}
    }
  });
  assert.equal("error" in toolNotFoundResponse, true);
  if ("error" in toolNotFoundResponse) {
    assert.equal(toolNotFoundResponse.error.code, -32004);
    assert.equal((toolNotFoundResponse.error.data as { category: string }).category, "not_found");
  }
  const policyViolationResponse = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    id: 13,
    method: "tools/call",
    params: {
      name: "query_database",
      arguments: {
        query: "DROP TABLE orders"
      }
    }
  });
  assert.equal("error" in policyViolationResponse, true);
  if ("error" in policyViolationResponse) {
    assert.equal(policyViolationResponse.error.code, -32003);
    assert.equal((policyViolationResponse.error.data as { category: string }).category, "policy_violation");
  }
  const initializedNotification = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {}
  });
  assert.equal(initializedNotification, null);
  const notificationCall = await stdioServer.handleProtocolMessage({
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "list_connections",
      arguments: {},
      client: "notification-client"
    }
  });
  assert.equal(notificationCall, null);

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
  const health = await fetch("http://127.0.0.1:3000/health").then((response) => response.json());
  assert.equal(health.ok, true);
  const initializeViaHttp = await fetch("http://127.0.0.1:3000/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer dev-api-key"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 20,
      method: "initialize",
      params: {}
    })
  }).then((response) => response.json());
  assert.equal(initializeViaHttp.jsonrpc, "2.0");
  assert.equal(initializeViaHttp.id, 20);
  assert.ok(initializeViaHttp.result);
  assert.equal(initializeViaHttp.result._meta.negotiatedCapabilities.ping, true);
  const resourcesViaHttp = await fetch("http://127.0.0.1:3000/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer dev-api-key"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 21,
      method: "resources/list",
      params: {}
    })
  }).then((response) => response.json());
  assert.equal(resourcesViaHttp.jsonrpc, "2.0");
  assert.equal(resourcesViaHttp.id, 21);
  assert.equal(Array.isArray(resourcesViaHttp.result.resources), true);
  const promptsViaHttp = await fetch("http://127.0.0.1:3000/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer dev-api-key"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 22,
      method: "prompts/list",
      params: {}
    })
  }).then((response) => response.json());
  assert.equal(promptsViaHttp.jsonrpc, "2.0");
  assert.equal(promptsViaHttp.id, 22);
  assert.equal(Array.isArray(promptsViaHttp.result.prompts), true);
  const rootsViaHttp = await fetch("http://127.0.0.1:3000/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer dev-api-key"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 23,
      method: "roots/list",
      params: {}
    })
  }).then((response) => response.json());
  assert.equal(rootsViaHttp.jsonrpc, "2.0");
  assert.equal(rootsViaHttp.id, 23);
  assert.equal(Array.isArray(rootsViaHttp.result.roots), true);
  const parseErrorViaHttp = await fetch("http://127.0.0.1:3000/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer dev-api-key"
    },
    body: "{invalid"
  }).then((response) => response.json());
  assert.equal(parseErrorViaHttp.error.code, -32700);
  assert.equal(parseErrorViaHttp.error.data.category, "invalid_request");
  const notificationViaHttp = await fetch("http://127.0.0.1:3000/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer dev-api-key"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {}
    })
  });
  assert.equal(notificationViaHttp.status, 202);
  assert.equal(await notificationViaHttp.text(), "");
  await httpServer.stop();
  await stdioServer.stop();
}

function testStepDefinitionsLoaded(): void {
  assert.equal(getRegisteredSteps().length > 0, true);
}

async function testFeatureRunner(): Promise<void> {
  const featureDir = join(process.cwd(), "sa");
  const featureFiles = (await readdir(featureDir))
    .filter((item) => item.endsWith(".feature"))
    .sort()
    .map((item) => join(featureDir, item));
  const results = [];
  for (const file of featureFiles) {
    results.push(await runFeatureFile(file));
  }
  assert.equal(results.length, featureFiles.length);
  assert.equal(results.every((item) => item.scenarios > 0 && item.steps > 0), true);
  process.stdout.write("Feature summary\n");
  for (const result of results) {
    process.stdout.write(
      `- ${result.feature}: ${result.featureName} | scenarios=${result.scenarios} | steps=${result.steps}\n`
    );
  }
}

async function testLiveMySqlIfConfigured(): Promise<void> {
  const host = process.env.MYSQL_LIVE_HOST;
  const port = process.env.MYSQL_LIVE_PORT;
  const database = process.env.MYSQL_LIVE_DATABASE;
  const username = process.env.MYSQL_LIVE_USER;
  const password = process.env.MYSQL_LIVE_PASSWORD;

  if (!host || !port || !database || !username || !password) {
    process.stdout.write("Live MySQL test skipped\n");
    return;
  }

  const driver = new MySQLDriver();
  await driver.connect({
    name: "live-mysql",
    type: "mysql2",
    host,
    port: Number(port),
    database,
    username,
    password
  });

  const result = await driver.execute("SELECT DATABASE() AS db, CURRENT_USER() AS user_name");
  assert.equal(result.rowCount > 0, true);
  const schema = await driver.discoverSchema({ depth: 1 });
  assert.equal(schema.database, database);
  assert.equal(schema.tables.length > 0, true);
  process.stdout.write(`Live MySQL test passed: database=${database}, tables=${schema.tables.length}\n`);
  await driver.disconnect();
}

async function main(): Promise<void> {
  await testConfigLoader();
  testSqlValidator();
  await testConnectionManager();
  await testLauncherCommand();
  await testSchemaCachePersistence();
  await testQueryTool();
  await testRegistryAndServer();
  testStepDefinitionsLoaded();
  await testFeatureRunner();
  await testLiveMySqlIfConfigured();
  process.stdout.write("All tests passed\n");
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
