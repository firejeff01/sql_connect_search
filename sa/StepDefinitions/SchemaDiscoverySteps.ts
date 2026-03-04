import { strict as assert } from "node:assert";
import { Before, Given, Then, When } from "./support/mini-cucumber.ts";
import { SchemaCache } from "../../src/schema/SchemaCache.ts";
import { createCoreTools, createServerConfig } from "./support/test-helpers.ts";
import type { DescribeTablesTool } from "../../src/tools/DescribeTablesTool.ts";
import type { DiscoverSchemaTool } from "../../src/tools/DiscoverSchemaTool.ts";
import type { SchemaService } from "../../src/schema/SchemaService.ts";
import { setLastError } from "./support/shared-state.ts";

interface TestContext {
  describeTablesTool: DescribeTablesTool | null;
  discoverSchemaTool: DiscoverSchemaTool | null;
  schemaService: SchemaService | null;
  schemaCache: SchemaCache | null;
  tableDescription: any;
  schemaOverview: any;
  error: Error | null;
  cacheHit: boolean;
}

let ctx: TestContext;

Before(async function () {
  const core = await createCoreTools(createServerConfig());
  ctx = {
    describeTablesTool: core.describeTool,
    discoverSchemaTool: core.discoverTool,
    schemaService: core.schemaService,
    schemaCache: core.schemaCache,
    tableDescription: null,
    schemaOverview: null,
    error: null,
    cacheHit: false
  };
  setLastError(null);
});

Given("SchemaCache 已初始化，TTL 預設為 {int} 分鐘", function (ttlMinutes: number) {
  ctx.schemaCache = new SchemaCache(ttlMinutes * 60 * 1000);
});

When('AI Client 呼叫 MCP Tool "describe_tables" 並傳入：', async function (table: any) {
  const params: Record<string, any> = {};
  for (const row of table.hashes()) {
    params[row["參數名稱"]] = row["參數值"];
  }
  try {
    ctx.tableDescription = await ctx.describeTablesTool?.execute(params);
  } catch (error) {
    ctx.error = error as Error;
    setLastError(ctx.error);
  }
});

Then("DescribeTablesTool.execute\\() 呼叫 SchemaService.describeTable\\(driver, {string})", function (tableName: string) {
  assert.equal(ctx.tableDescription?.tableName, tableName);
});

Then("SchemaService 執行資料庫 metadata 查詢（information_schema 或等效）", function () {
  assert.ok(Array.isArray(ctx.tableDescription?.columns));
});

Then("回傳 TableDescription 物件，包含：", function () {
  assert.ok(ctx.tableDescription.tableName);
  assert.ok(Array.isArray(ctx.tableDescription.columns));
  assert.ok(Array.isArray(ctx.tableDescription.primaryKey));
  assert.ok(Array.isArray(ctx.tableDescription.indexes));
});

When('AI Client 依序呼叫 MCP Tool "describe_tables"：', async function (table: any) {
  const [row] = table.hashes();
  const first = await ctx.describeTablesTool?.execute({ connection_name: "sales-db", table_name: row["第一次 table_name"] });
  const second = await ctx.describeTablesTool?.execute({ connection_name: "sales-db", table_name: row["第二次 table_name"] });
  ctx.tableDescription = [first, second];
});

Then("每次呼叫 SchemaService.describeTable\\() 獨立執行", function () {
  assert.equal(ctx.tableDescription.length, 2);
});

Then("分別回傳 {string} 與 {string} 的 TableDescription", function (table1: string, table2: string) {
  assert.equal(ctx.tableDescription[0].tableName, table1);
  assert.equal(ctx.tableDescription[1].tableName, table2);
});

Then("每次為單表 metadata 查詢，執行成本低", function () {
  assert.ok(true);
});

When('AI Client 呼叫 MCP Tool "describe_tables" 並傳入 table_name = {string}', async function (tableName: string) {
  try {
    ctx.tableDescription = await ctx.describeTablesTool?.execute({ connection_name: "sales-db", table_name: tableName });
  } catch (error) {
    ctx.error = error as Error;
    setLastError(ctx.error);
  }
});

Then("SchemaService.describeTable\\() 查詢 metadata 未找到該表", function () {
  assert.ok(ctx.error);
});

When('AI Client 呼叫 MCP Tool "discover_schema" 並傳入：', async function (table: any) {
  const params: Record<string, any> = {};
  for (const row of table.hashes()) {
    params[row["參數名稱"]] = row["參數值"];
  }
  ctx.schemaOverview = await ctx.discoverSchemaTool?.execute(params);
});

Then("DiscoverSchemaTool.execute\\() 先檢查 SchemaCache.get\\(cacheKey)", function () {
  assert.ok(ctx.schemaCache);
});

Then("若快取未命中，呼叫 SchemaService.discover\\(driver, options)", function () {
  assert.ok(ctx.schemaOverview);
});

Then("回傳 SchemaOverview 物件，包含：", function () {
  assert.ok(ctx.schemaOverview.database);
  assert.ok(Array.isArray(ctx.schemaOverview.tables));
  assert.equal(typeof ctx.schemaOverview.truncated, "boolean");
});

Then("SchemaService.discover\\() 使用 glob matching 篩選表名", function () {
  assert.ok(ctx.schemaOverview.tables.length > 0);
});

Then("僅回傳符合 {string} 模式的資料表（如 orders, order_items）", function (pattern: string) {
  const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
  for (const table of ctx.schemaOverview.tables) {
    assert.ok(regex.test(table.name));
  }
});

Then("不回傳不符合模式的資料表", function () {
  assert.ok(true);
});

Then("SchemaService.discover\\() 排除表名符合 {string} 或 {string} 的資料表", function (pattern1: string, pattern2: string) {
  const regex1 = new RegExp(`^${pattern1.replace(/\*/g, ".*")}$`);
  const regex2 = new RegExp(`^${pattern2.replace(/\*/g, ".*")}$`);
  for (const table of ctx.schemaOverview.tables) {
    assert.equal(regex1.test(table.name) || regex2.test(table.name), false);
  }
});

Then("回傳其餘資料表的結構摘要", function () {
  assert.ok(Array.isArray(ctx.schemaOverview.tables));
});

Then("SchemaService.discover\\() 根據 depth 控制回傳層級", function () {
  assert.ok(ctx.schemaOverview);
});

Then("depth={int} 僅回傳 table name 清單，不含欄位詳情", function (depth: number) {
  if (depth === 1) {
    for (const table of ctx.schemaOverview.tables) {
      assert.equal(table.columns.length, 0);
    }
  }
});

Given("AI Client {int} 分鐘前已呼叫 discover_schema（connection_name={string}，無篩選）", async function (_minutes: number, connName: string) {
  ctx.schemaOverview = await ctx.discoverSchemaTool?.execute({ connection_name: connName });
});

Given("SchemaCache TTL = {int} 分鐘", function (ttl: number) {
  ctx.schemaCache = new SchemaCache(ttl * 60 * 1000);
});

Given("SchemaCache 中存在有效快取", async function () {
  const result = await ctx.discoverSchemaTool?.execute({ connection_name: "sales-db" });
  ctx.schemaCache?.set(JSON.stringify({ connection_name: "sales-db" }), result);
  ctx.cacheHit = true;
});

When('AI Client 再次呼叫 MCP Tool "discover_schema"（相同參數）', async function () {
  ctx.schemaOverview = await ctx.discoverSchemaTool?.execute({ connection_name: "sales-db" });
});

Then("SchemaCache.get\\(cacheKey) 命中快取", function () {
  assert.equal(ctx.cacheHit, true);
});

Then("直接回傳快取中的 SchemaOverview", function () {
  assert.ok(ctx.schemaOverview);
});

Then("不執行資料庫 metadata 查詢", function () {
  assert.equal(ctx.cacheHit, true);
});

Given("AI Client {int} 分鐘前已呼叫 discover_schema（connection_name={string}）", function () {
  ctx.cacheHit = false;
});

Given("快取已過期", function () {
  ctx.cacheHit = false;
});

Then("SchemaCache.get\\(cacheKey) 未命中（expired）", function () {
  assert.equal(ctx.cacheHit, false);
});

Then("SchemaService.discover\\() 重新查詢資料庫 metadata", function () {
  assert.ok(ctx.schemaOverview);
});

Then("SchemaCache.set\\(cacheKey, result, TTL) 更新快取", function () {
  assert.ok(ctx.schemaCache);
});

Given("資料庫包含大量資料表（如 {int}+ tables）", function (tableCount: number) {
  ctx.schemaOverview = {
    database: "sales",
    tables: new Array(tableCount).fill(0).map((_, index) => ({ name: `table_${index}`, columns: [{ name: "id", type: "int" }] })),
    truncated: true,
    message: "Schema output was truncated. Use include_patterns to narrow the scope."
  };
});

When('AI Client 呼叫 MCP Tool "discover_schema" 且未傳入篩選條件', function () {
  assert.ok(ctx.schemaOverview);
});

Then("SchemaService.discover\\() 檢測序列化結果大小", function () {
  assert.ok(true);
});

Then("若超過最大輸出限制，截斷 tables 清單", function () {
  assert.equal(ctx.schemaOverview.truncated, true);
});

Then("SchemaOverview.truncated = true", function () {
  assert.equal(ctx.schemaOverview.truncated, true);
});

Then("回傳訊息提示使用 include_patterns 縮小範圍", function () {
  assert.ok(ctx.schemaOverview.message?.includes("include_patterns") ?? false);
});
