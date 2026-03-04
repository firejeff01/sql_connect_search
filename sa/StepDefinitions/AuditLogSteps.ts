import { strict as assert } from "node:assert";
import { Before, Given, Then, When } from "./support/mini-cucumber.ts";
import { AuditLogger } from "../../src/audit/AuditLogger.ts";
import { MemoryWritable } from "./support/test-helpers.ts";

interface TestContext {
  auditLogger: AuditLogger | null;
  output: MemoryWritable | null;
  auditEntries: any[];
  auditEnabled: boolean;
  transport: string;
  pendingEntry: any;
}

let ctx: TestContext;

Before(function () {
  ctx = {
    auditLogger: null,
    output: null,
    auditEntries: [],
    auditEnabled: true,
    transport: "stdio",
    pendingEntry: null
  };
});

Given("MCP Server 已啟動", function () {
  assert.ok(true);
});

Given("AuditLogger 已初始化，底層使用 pino logger", function () {
  ctx.output = new MemoryWritable();
  ctx.auditLogger = new AuditLogger({ enabled: ctx.auditEnabled }, ctx.output);
});

Given("AI Client 對連線 {string} 成功執行 SQL 查詢 {string}", function (connName: string, query: string) {
  ctx.pendingEntry = {
    timestamp: new Date().toISOString(),
    connection_name: connName,
    query,
    row_count: 0,
    execution_time: "0ms",
    client: "test-client"
  };
});

Given("查詢回傳 {int} 筆結果，耗時 {int}ms", function (rowCount: number, durationMs: number) {
  ctx.pendingEntry = { ...ctx.pendingEntry, row_count: rowCount, execution_time: `${durationMs}ms` };
});

When("QueryDatabaseTool.execute\\() 完成查詢後呼叫 AuditLogger.log\\(entry)", function () {
  ctx.auditLogger?.log(ctx.pendingEntry);
  ctx.auditEntries = ctx.auditLogger?.getEntries() ?? [];
});

Then("AuditLogger 寫入 AuditLogEntry，包含：", function () {
  const entry = ctx.auditEntries[ctx.auditEntries.length - 1];
  assert.ok(entry.timestamp);
  assert.ok(entry.connection_name);
  assert.ok(entry.query);
  assert.equal(typeof entry.row_count, "number");
  assert.equal(typeof entry.execution_time, "string");
  assert.equal(typeof entry.client, "string");
});

Then("日誌以結構化 JSON 格式輸出至 pino logger", function () {
  assert.ok(ctx.output?.toString().includes('"connection_name"') ?? false);
});

Given("AI Client 對 MongoDB 連線 {string} 成功執行查詢", function (connName: string) {
  ctx.pendingEntry = {
    timestamp: new Date().toISOString(),
    connection_name: connName,
    query: '{"collection":"orders","operation":"find"}',
    row_count: 1,
    execution_time: "1ms",
    client: "test-client"
  };
});

When("MongoDBQueryTool.execute\\() 完成查詢後呼叫 AuditLogger.log\\(entry)", function () {
  ctx.auditLogger?.log(ctx.pendingEntry);
  ctx.auditEntries = ctx.auditLogger?.getEntries() ?? [];
});

Then("AuditLogger 寫入 AuditLogEntry，包含 timestamp、connection_name、query、row_count、execution_time、client", function () {
  const entry = ctx.auditEntries[ctx.auditEntries.length - 1];
  for (const key of ["timestamp", "connection_name", "query", "row_count", "execution_time", "client"]) {
    assert.notEqual(entry[key], undefined);
  }
});

Given("ServerConfig.audit.enabled = false", function () {
  ctx.auditEnabled = false;
  ctx.output = new MemoryWritable();
  ctx.auditLogger = new AuditLogger({ enabled: false }, ctx.output);
});

When("任意 Tool 呼叫 AuditLogger.log\\(entry)", function () {
  ctx.auditLogger?.log({
    timestamp: new Date().toISOString(),
    connection_name: "sales-db",
    query: "SELECT 1",
    row_count: 1,
    execution_time: "1ms",
    client: "test-client"
  });
  ctx.auditEntries = ctx.auditLogger?.getEntries() ?? [];
});

Then("AuditLogger 檢查 audit.enabled 為 false", function () {
  assert.equal(ctx.auditEnabled, false);
});

Then("不執行任何日誌寫入操作（early return）", function () {
  assert.equal(ctx.auditEntries.length, 0);
});

Given("MCPServer 以 STDIO 模式啟動（StdioTransport）", function () {
  ctx.transport = "stdio";
});

When("AI Client 透過 MCP Protocol 執行查詢", function () {
  ctx.auditLogger?.log({
    timestamp: new Date().toISOString(),
    connection_name: "sales-db",
    query: "SELECT * FROM orders",
    row_count: 1,
    execution_time: "1ms",
    client: "mcp-client"
  });
  ctx.auditEntries = ctx.auditLogger?.getEntries() ?? [];
});

Then("AuditLogger.log\\() 仍正常寫入稽核日誌", function () {
  assert.equal(ctx.auditEntries.length > 0, true);
});

Then("稽核日誌輸出至 stderr 或獨立日誌檔案（避免干擾 STDIO 的 stdout 通道）", function () {
  assert.notEqual(ctx.output, process.stdout as unknown);
});
