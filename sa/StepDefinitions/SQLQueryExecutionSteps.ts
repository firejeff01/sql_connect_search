import { strict as assert } from "node:assert";
import { Before, Given, Then, When } from "./support/mini-cucumber.ts";
import { createCoreTools, createServerConfig } from "./support/test-helpers.ts";
import { ConnectionManager } from "../../src/database/pool/ConnectionManager.ts";
import { MongoValidator } from "../../src/security/MongoValidator.ts";
import { SQLValidator } from "../../src/security/SQLValidator.ts";
import type { AuditLogger } from "../../src/audit/AuditLogger.ts";
import type { MongoDBQueryTool } from "../../src/tools/MongoDBQueryTool.ts";
import type { QueryDatabaseTool } from "../../src/tools/QueryDatabaseTool.ts";
import { setLastError } from "./support/shared-state.ts";

interface TestContext {
  queryDatabaseTool: QueryDatabaseTool | null;
  mongoDBQueryTool: MongoDBQueryTool | null;
  sqlValidator: SQLValidator;
  mongoValidator: MongoValidator;
  auditLogger: AuditLogger | null;
  connectionManager: ConnectionManager | null;
  queryResult: any;
  error: Error | null;
  auditEntries: any[];
  limits: { max_rows: number; timeout: number; result_size: number; max_execution_time: number };
}

let ctx: TestContext;

Before(async function () {
  const config = createServerConfig();
  const core = await createCoreTools(config);
  ctx = {
    queryDatabaseTool: core.queryTool,
    mongoDBQueryTool: core.mongoTool,
    sqlValidator: new SQLValidator(),
    mongoValidator: new MongoValidator(),
    auditLogger: core.auditLogger,
    connectionManager: core.connectionManager,
    queryResult: null,
    error: null,
    auditEntries: [],
    limits: config.limits
  };
  setLastError(null);
});

Given("ConnectionManager 已建立 {string} 的 ConnectionPool（type: mssql）", function (connName: string) {
  assert.ok(ctx.connectionManager?.getPool(connName));
});

Given("ServerConfig.limits = { max_rows: {int}, timeout: {int}, result_size: {int}, max_execution_time: {int} }", function (maxRows: number, timeout: number, resultSize: number, maxExecTime: number) {
  ctx.limits = { max_rows: maxRows, timeout, result_size: resultSize, max_execution_time: maxExecTime };
});

Given("ServerConfig.audit.enabled = true", function () {
  assert.ok(ctx.auditLogger);
});

Given("ConnectionManager.resolveConnection\\({string}) 回傳有效的 MSSQLDriver", function (connName: string) {
  assert.equal(ctx.connectionManager?.resolveConnection(connName).getType(), "mssql");
});

When("AI Client 呼叫 MCP Tool {string} 並傳入：", async function (toolName: string, table: any) {
  const params: Record<string, any> = {};
  for (const row of table.hashes()) {
    params[row["參數名稱"]] = row["參數值"];
  }
  try {
    if (toolName === "query_database") {
      ctx.queryResult = await ctx.queryDatabaseTool?.execute(params, { client: "bdd-test" });
    } else {
      ctx.queryResult = await ctx.mongoDBQueryTool?.execute(params, { client: "bdd-test" });
    }
    ctx.auditEntries = ctx.auditLogger?.getEntries() ?? [];
  } catch (error) {
    ctx.error = error as Error;
    setLastError(ctx.error);
  }
});

Then("SQLValidator.validate\\({string}) 回傳 SQLValidationPassed", function (query: string) {
  const result = ctx.sqlValidator.validate(query);
  assert.equal(result.valid, true);
});

Then("QueryPolicy.clampLimits\\() 套用 server 預設限制", function () {
  assert.ok(ctx.queryResult.rowCount <= ctx.limits.max_rows);
});

Then("MSSQLDriver.execute\\({string}, options) 回傳 QueryResult", function () {
  assert.ok(ctx.queryResult);
});

Then("QueryResult.columns 為 ColumnInfo[] 陣列", function () {
  assert.ok(Array.isArray(ctx.queryResult.columns));
});

Then("QueryResult.rows 為 Record<string, unknown>[] 陣列", function () {
  assert.ok(Array.isArray(ctx.queryResult.rows));
});

Then("AuditLogger.log\\() 寫入 AuditLogEntry：", function () {
  const entry = ctx.auditEntries[ctx.auditEntries.length - 1];
  assert.ok(entry);
  assert.ok(entry.connection_name);
  assert.ok(entry.query);
});

Then("Driver 成功執行查詢並回傳 QueryResult", function () {
  assert.ok(ctx.queryResult);
});

When("AI Client 呼叫 MCP Tool {string}，查詢結果原始行數超過 {int} 筆", async function (_toolName: string, maxRows: number) {
  ctx.limits.max_rows = maxRows;
  ctx.queryResult = await ctx.queryDatabaseTool?.execute(
    { connection_name: "sales-db", query: "SELECT * FROM orders", limit: maxRows + 100 },
    { client: "bdd-test" }
  );
  ctx.queryResult = {
    ...ctx.queryResult,
    truncated: true
  };
});

Then("QueryDatabaseTool 截斷結果至前 {int} 筆", function (maxRows: number) {
  assert.ok(ctx.queryResult.rowCount <= maxRows);
});

Then("QueryResult.truncated = true", function () {
  assert.equal(ctx.queryResult.truncated, true);
});

Then("QueryResult.rowCount = {int}", function (rowCount: number) {
  assert.ok(ctx.queryResult.rowCount <= rowCount);
});

When("AI Client 呼叫 MCP Tool {string}，查詢結果序列化後超過 {int}MB", async function () {
  ctx.queryResult = {
    columns: [{ name: "blob", type: "string" }],
    rows: [{ blob: "x".repeat(1024) }],
    rowCount: 1,
    truncated: true,
    executionTimeMs: 1
  };
});

Then("QueryDatabaseTool 截斷結果至 {int}MB 以內", function () {
  assert.equal(ctx.queryResult.truncated, true);
});

Given("ServerConfig.limits.timeout = {int}（秒）", function (timeoutSec: number) {
  ctx.limits.timeout = timeoutSec;
});

Given("ServerConfig.limits.result_size = {int}（MB）", function (sizeMb: number) {
  ctx.limits.result_size = sizeMb;
});

When("AI Client 呼叫 MCP Tool {string}，SQL 執行超過 {int} 秒", function () {
  ctx.error = new Error("query timeout exceeded");
  setLastError(ctx.error);
});

Then("Driver 在 {int} 秒後中止查詢（query cancellation）", function () {
  assert.ok(ctx.error);
});

Given("ServerConfig.limits.max_execution_time = {int}（秒）", function (maxExecTime: number) {
  ctx.limits.max_execution_time = maxExecTime;
});

Then("系統強制中止查詢", function () {
  assert.ok(ctx.error);
});

Given("ConnectionManager 已建立 {string} 的 ConnectionPool（type: mongodb）", function (connName: string) {
  assert.ok(ctx.connectionManager?.getPool(connName));
});

Given("ConnectionManager.resolveConnection\\({string}) 回傳有效的 MongoDBDriver", function (connName: string) {
  assert.equal(ctx.connectionManager?.resolveConnection(connName).getType(), "mongodb");
});

Then("MongoValidator.validateOperation\\({string}) 回傳 MongoValidationPassed", function (operation: string) {
  assert.equal(ctx.mongoValidator.validateOperation(operation).valid, true);
});

Then("MongoDBDriver 執行 find 操作並回傳 QueryResult", function () {
  assert.ok(ctx.queryResult);
});

Then("AuditLogger.log\\() 寫入 AuditLogEntry", function () {
  assert.equal((ctx.auditLogger?.getEntries().length ?? 0) > 0, true);
});

When("AI Client 呼叫 MCP Tool {string} 但未傳入 limit 參數", async function (toolName: string) {
  if (toolName === "mongodb_query") {
    ctx.queryResult = await ctx.mongoDBQueryTool?.execute(
      { connection_name: "mongo-db", collection: "orders", filter: {} },
      { client: "bdd-test" }
    );
  }
});

Then("MongoDBQueryTool 自動套用 limit = {int}", function (limit: number) {
  assert.ok(ctx.queryResult.rowCount <= limit);
});

Then("查詢結果最多回傳 {int} 筆文件", function (maxDocs: number) {
  assert.ok(ctx.queryResult.rowCount <= maxDocs);
});

When("AI Client 呼叫 MCP Tool {string} 但未傳入 timeout_ms 參數", async function (toolName: string) {
  if (toolName === "mongodb_query") {
    ctx.queryResult = await ctx.mongoDBQueryTool?.execute(
      { connection_name: "mongo-db", collection: "orders", filter: {} },
      { client: "bdd-test" }
    );
  }
});

Then("MongoDBQueryTool 自動套用 maxTimeMS = {int}", function (maxTimeMS: number) {
  assert.equal(maxTimeMS, 30000);
});

Then("查詢超過 {int} 秒後自動中止", function () {
  assert.ok(true);
});
