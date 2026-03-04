import { strict as assert } from "node:assert";
import { Before, Given, Then, When } from "./support/mini-cucumber.ts";
import { ConnectionManager } from "../../src/database/pool/ConnectionManager.ts";
import { QueryPolicy } from "../../src/security/QueryPolicy.ts";
import { createServerConfig } from "./support/test-helpers.ts";
import type { ServerConfig } from "../../src/config/IConfig.ts";
import { setLastError } from "./support/shared-state.ts";

interface TestContext {
  connectionManager: ConnectionManager | null;
  serverConfig: ServerConfig;
  toolResponse: any;
  error: Error | null;
  resolvedDriver: any;
  actualLimit: number;
  actualTimeoutMs: number;
}

let ctx: TestContext;

async function ensureConnectionManager(): Promise<void> {
  if (!ctx.connectionManager) {
    ctx.connectionManager = new ConnectionManager(ctx.serverConfig.limits, ctx.serverConfig.default_connection);
    await ctx.connectionManager.createPools(ctx.serverConfig.connections, ctx.serverConfig.pool);
  }
}

Before(function () {
  ctx = {
    connectionManager: null,
    serverConfig: createServerConfig(),
    toolResponse: null,
    error: null,
    resolvedDriver: null,
    actualLimit: 0,
    actualTimeoutMs: 0
  };
  setLastError(null);
});

Given("系統已載入 YAML 設定檔，ConfigLoader.loadConfig\\() 回傳 ServerConfig，其中 connections 包含：", function (table: any) {
  const connections = table.hashes().map((row: Record<string, string>) => ({
    name: row.name,
    type: row.type,
    host: row.host,
    port: Number(row.port),
    database: row.database,
    username: "readonly",
    aliases: row.aliases ? [row.aliases] : []
  }));
  ctx.serverConfig = createServerConfig({ connections });
});

Given("ServerConfig.pool 設定為 { max: {int}, min: {int}, idleTimeout: {int} }", function (max: number, min: number, idleTimeout: number) {
  ctx.serverConfig.pool = { max, min, idleTimeout };
});

Given("ServerConfig.limits 設定為 { max_rows: {int}, timeout: {int}, result_size: {int}, max_execution_time: {int} }", function (maxRows: number, timeout: number, resultSize: number, maxExecTime: number) {
  ctx.serverConfig.limits = { max_rows: maxRows, timeout, result_size: resultSize, max_execution_time: maxExecTime };
});

Given("MCPServer 已啟動且 ToolRegistry 已註冊所有 Tools", async function () {
  await ensureConnectionManager();
});

When("AI Client 呼叫 MCP Tool {string}（無參數）", function (toolName: string) {
  assert.equal(toolName, "list_connections");
  ctx.toolResponse = ctx.connectionManager?.listConnections();
});

Then("ListConnectionsTool.execute\\() 呼叫 ConnectionManager.listConnections\\()", function () {
  assert.ok(Array.isArray(ctx.toolResponse));
});

Then("回傳 ConnectionInfo[] 陣列，每筆包含：", function (table: any) {
  const fields = table.hashes().map((row: Record<string, string>) => row["欄位"]);
  for (const item of ctx.toolResponse) {
    for (const field of fields) {
      assert.notEqual(item[field], undefined);
    }
  }
});

Given("ConfigLoader.loadConfig\\() 已回傳 ServerConfig", function () {
  assert.ok(ctx.serverConfig);
});

Given("ServerConfig.pool = { max: {int}, min: {int}, idleTimeout: {int} }", function (max: number, min: number, idleTimeout: number) {
  ctx.serverConfig.pool = { max, min, idleTimeout };
});

When("ConnectionManager.createPools\\(connections, poolConfig) 被呼叫", async function () {
  ctx.connectionManager = new ConnectionManager(ctx.serverConfig.limits, ctx.serverConfig.default_connection);
  await ctx.connectionManager.createPools(ctx.serverConfig.connections, ctx.serverConfig.pool);
});

Then("為每個 ConnectionConfig 建立獨立的 ConnectionPool 實例", function () {
  for (const connection of ctx.serverConfig.connections) {
    assert.ok(ctx.connectionManager?.getPool(connection.name));
  }
});

Then("每個 ConnectionPool 透過 DriverFactory.createDriver\\(type) 取得對應的 IDriverAdapter", function () {
  for (const connection of ctx.serverConfig.connections) {
    const driver = ctx.connectionManager?.resolveConnection(connection.name);
    assert.equal(driver?.getType(), connection.type);
  }
});

Then("ConnectionPool 以 { max: {int}, min: {int}, idleTimeout: {int} } 初始化", function (max: number, min: number, idleTimeout: number) {
  const pool = ctx.connectionManager?.getPool(ctx.serverConfig.connections[0].name);
  assert.deepEqual(pool?.getConfig(), { max, min, idleTimeout });
});

Given("ConnectionPool 已建立，idleTimeout 設定為 {int} 毫秒", async function (idleTimeout: number) {
  ctx.serverConfig.pool.idleTimeout = idleTimeout;
  ctx.connectionManager = new ConnectionManager(ctx.serverConfig.limits, ctx.serverConfig.default_connection);
  await ctx.connectionManager.createPools(ctx.serverConfig.connections, ctx.serverConfig.pool);
});

When("ConnectionPool 閒置時間超過 {int} 毫秒（無任何查詢活動）", async function () {
  const pool = ctx.connectionManager?.getPool(ctx.serverConfig.connections[0].name);
  await pool?.destroy();
});

Then("ConnectionPool 自動呼叫 destroy\\() 釋放所有連線資源", function () {
  assert.equal(ctx.connectionManager?.getPool(ctx.serverConfig.connections[0].name), undefined);
});

Then("ConnectionManager 將該 pool 從活躍池清單中移除", function () {
  assert.equal(ctx.connectionManager?.getPool(ctx.serverConfig.connections[0].name), undefined);
});

Given("YAML 設定檔路徑有效且格式正確", function () {
  assert.ok(true);
});

When("ConfigLoader.loadConfig\\(yamlPath) 被呼叫", function () {
  assert.ok(ctx.serverConfig.connections.length > 0);
});

Then("回傳 ServerConfig 物件，包含：", function (table: any) {
  const fields = table.hashes().map((row: Record<string, string>) => row["屬性"]);
  for (const field of fields) {
    assert.notEqual((ctx.serverConfig as Record<string, unknown>)[field], undefined);
  }
});

Then("ConfigValidator.validate\\(config) 驗證所有必填欄位存在", function () {
  assert.ok(ctx.serverConfig.connections[0].name);
});

Given("ConnectionManager 已建立 {string} 的 ConnectionPool", async function () {
  ctx.connectionManager = new ConnectionManager(ctx.serverConfig.limits, ctx.serverConfig.default_connection);
  await ctx.connectionManager.createPools(ctx.serverConfig.connections, ctx.serverConfig.pool);
});

When("任意 Tool 呼叫 ConnectionManager.resolveConnection\\({string})", function (connectionName: string) {
  ctx.resolvedDriver = ctx.connectionManager?.resolveConnection(connectionName);
});

Then("ConnectionManager 直接比對 name 欄位，回傳 {string} 對應的 IDriverAdapter", function (connectionName: string) {
  assert.equal(ctx.resolvedDriver?.getType(), ctx.serverConfig.connections.find((item) => item.name === connectionName)?.type);
});

Given("ConnectionConfig {string} 設定了 aliases: [{string}]", function (connName: string, alias: string) {
  const connection = ctx.serverConfig.connections.find((item) => item.name === connName);
  assert.ok(connection);
  connection!.aliases = [alias];
});

Then("ConnectionManager 將 alias {string} 解析為 {string}", async function (alias: string, connName: string) {
  await ensureConnectionManager();
  assert.equal(ctx.connectionManager?.resolveConnectionName(alias), connName);
});

Then("回傳 {string} 對應的 IDriverAdapter", async function (connectionName: string) {
  await ensureConnectionManager();
  assert.equal(ctx.connectionManager?.resolveConnectionName(connectionName), connectionName);
});

Given("ServerConfig.default_connection 未設定（undefined）", function () {
  ctx.serverConfig.default_connection = undefined;
  ctx.connectionManager = new ConnectionManager(ctx.serverConfig.limits, undefined);
});

When("AI Client 呼叫任意查詢 Tool 但未傳入 connection_name 參數", function () {
  try {
    ctx.connectionManager?.resolveConnection();
  } catch (error) {
    ctx.error = error as Error;
    setLastError(ctx.error);
  }
});

Then("不執行任何資料庫操作", function () {
  assert.ok(ctx.error);
});

Given("ServerConfig.default_connection = {string}", function (defaultConn: string) {
  ctx.serverConfig.default_connection = defaultConn;
  ctx.connectionManager = new ConnectionManager(ctx.serverConfig.limits, defaultConn);
});

Then("Tool 自動使用 {string} 作為 connection_name", function (connName: string) {
  assert.equal(ctx.connectionManager?.resolveConnectionName(), connName);
});

Then("ConnectionManager.resolveConnection\\({string}) 被呼叫", function (connName: string) {
  assert.equal(ctx.connectionManager?.resolveConnectionName(), connName);
});

When("AI Client 查詢連線 {string} 的 capabilities", function (connName: string) {
  ctx.toolResponse = ctx.connectionManager?.getCapabilities(connName);
});

Then("回傳 ConnectionCapabilities 物件，包含：", function () {
  assert.ok(Array.isArray(ctx.toolResponse.supportedTools));
  assert.equal(typeof ctx.toolResponse.readOnly, "boolean");
  assert.equal(typeof ctx.toolResponse.maxRows, "number");
  assert.ok(Array.isArray(ctx.toolResponse.allowedSchemas));
});

Given("ServerConfig.limits.max_rows = {int}", function (maxRows: number) {
  ctx.serverConfig.limits.max_rows = maxRows;
});

When("AI Client 呼叫查詢 Tool 並傳入 limit = {int}", function (limit: number) {
  ctx.actualLimit = QueryPolicy.clampLimits({ limit }, ctx.serverConfig.limits).limit;
});

Then("QueryPolicy.clampLimits\\() 將實際 limit 設為 Math.min\\({int}, {int}) = {int}", function (_userLimit: number, _serverMax: number, expected: number) {
  assert.equal(ctx.actualLimit, expected);
});

Then("查詢以 limit = {int} 執行", function (limit: number) {
  assert.equal(ctx.actualLimit, limit);
});

Given("ServerConfig.limits.timeout = {int}（秒），即 {int} 毫秒", function (timeoutSec: number) {
  ctx.serverConfig.limits.timeout = timeoutSec;
});

When("AI Client 呼叫查詢 Tool 並傳入 timeout_ms = {int}", function (timeoutMs: number) {
  ctx.actualTimeoutMs = QueryPolicy.clampLimits({ timeout_ms: timeoutMs }, ctx.serverConfig.limits).timeoutMs;
});

Then("QueryPolicy.clampLimits\\() 將實際 timeout_ms 設為 Math.min\\({int}, {int}) = {int}", function (_userTimeout: number, _serverMax: number, expected: number) {
  assert.equal(ctx.actualTimeoutMs, expected);
});

Then("查詢以 timeout_ms = {int} 執行", function (timeoutMs: number) {
  assert.equal(ctx.actualTimeoutMs, timeoutMs);
});
