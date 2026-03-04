import { strict as assert } from "node:assert";
import { Before, Given, Then, When } from "./support/mini-cucumber.ts";
import { DriverFactory } from "../../src/database/drivers/DriverFactory.ts";

interface TestContext {
  driver: any;
  queryResult: any;
  connectionConfig: any;
}

let ctx: TestContext;

Before(function () {
  ctx = {
    driver: null,
    queryResult: null,
    connectionConfig: null
  };
});

Given("DriverFactory 已初始化", function () {
  assert.ok(DriverFactory);
});

Given("設定檔中包含類型為 {string} 的連線，對應 driver 為 {string}", function (_dbType: string, driver: string) {
  ctx.connectionConfig = {
    name: "test-db",
    type: driver,
    host: "127.0.0.1",
    port: 1234,
    database: "demo",
    username: "readonly"
  };
});

When("DriverFactory.createDriver\\({string}) 被呼叫", function (driver: any) {
  ctx.driver = DriverFactory.createDriver(driver);
});

Then("回傳對應的 IDriverAdapter 實作類別 {string}", function (driverClass: string) {
  assert.equal(ctx.driver.constructor.name, driverClass);
});

Then("該 IDriverAdapter.connect\\(config) 成功建立連線", async function () {
  await ctx.driver.connect(ctx.connectionConfig);
  assert.equal(ctx.driver.isConnected(), true);
});

Then("該 IDriverAdapter.execute\\(query) 回傳 QueryResult 格式：{ columns: ColumnInfo[], rows: Record<string, unknown>[], rowCount: number, truncated: boolean, executionTimeMs: number }", async function () {
  ctx.queryResult = await ctx.driver.execute("SELECT * FROM orders");
  assert.ok(Array.isArray(ctx.queryResult.columns));
  assert.ok(Array.isArray(ctx.queryResult.rows));
  assert.equal(typeof ctx.queryResult.rowCount, "number");
  assert.equal(typeof ctx.queryResult.truncated, "boolean");
  assert.equal(typeof ctx.queryResult.executionTimeMs, "number");
});

Given("AI Client 對任一資料庫的 IDriverAdapter 執行查詢", async function () {
  ctx.driver = DriverFactory.createDriver("mssql");
  await ctx.driver.connect({
    name: "sales-db",
    type: "mssql",
    host: "127.0.0.1",
    port: 1433,
    database: "sales",
    username: "readonly"
  });
});

When("IDriverAdapter.execute\\(query) 成功執行", async function () {
  ctx.queryResult = await ctx.driver.execute("SELECT * FROM orders");
});

Then("回傳的 QueryResult 物件結構為：", function () {
  for (const key of ["columns", "rows", "rowCount", "truncated", "executionTimeMs"]) {
    assert.notEqual(ctx.queryResult[key], undefined);
  }
});

Then("ColumnInfo 結構為：{ name: string, type: string }", function () {
  for (const column of ctx.queryResult.columns) {
    assert.equal(typeof column.name, "string");
    assert.equal(typeof column.type, "string");
  }
});
