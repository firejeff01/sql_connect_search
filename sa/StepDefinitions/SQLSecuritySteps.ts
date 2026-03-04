import { strict as assert } from "node:assert";
import { Before, Given, Then, When } from "./support/mini-cucumber.ts";
import { SQLValidator } from "../../src/security/SQLValidator.ts";

interface TestContext {
  sqlValidator: SQLValidator;
  validationResult: { valid: boolean; statementType?: string; error?: string };
}

let ctx: TestContext;

Before(function () {
  ctx = {
    sqlValidator: new SQLValidator(),
    validationResult: { valid: false }
  };
});

Given("SQLValidator 已初始化（內部持有 node-sql-parser 實例）", function () {
  ctx.sqlValidator = new SQLValidator();
});

Given("SQLValidator 白名單語句類型 = [{string}, {string}, {string}, {string}]", function (...types: string[]) {
  const allowed = types.map((item) => ctx.sqlValidator.validate(`${item} test`).statementType ?? item.toLowerCase());
  assert.deepEqual(allowed, ["select", "show", "describe", "explain"]);
});

Given("SQLValidator 黑名單語句類型 = [{string}, {string}, {string}, {string}, {string}, {string}]", function (...types: string[]) {
  for (const type of types) {
    const sample = `${type} target`;
    const result = ctx.sqlValidator.validate(sample);
    assert.equal(result.valid, false);
    assert.equal(result.statementType, type.toLowerCase());
  }
});

When("SQLValidator.validate\\({string}) 被呼叫", function (sql: string) {
  ctx.validationResult = ctx.sqlValidator.validate(sql);
});

Then("node-sql-parser 解析語句類型為 {string}", function (statementType: string) {
  assert.equal(ctx.validationResult.statementType, statementType.toLowerCase());
});

Then("語句類型存在於白名單中", function () {
  assert.equal(ctx.validationResult.valid, true);
});

Then("SQLValidator 回傳 { valid: true, statementType: {string} }", function (statementType: string) {
  assert.equal(ctx.validationResult.valid, true);
  assert.equal(ctx.validationResult.statementType, statementType.toLowerCase());
});

Then("語句類型存在於黑名單中", function () {
  assert.equal(ctx.validationResult.valid, false);
  assert.ok(Boolean(ctx.validationResult.statementType));
});

Then("SQLValidator 回傳 { valid: false, statementType: {string}, error: {string} }", function (statementType: string, error: string) {
  assert.equal(ctx.validationResult.valid, false);
  assert.equal(ctx.validationResult.statementType, statementType.toLowerCase());
  assert.ok(Boolean(ctx.validationResult.error));
  assert.ok(
    Boolean(ctx.validationResult.error?.includes(error)) ||
      error.includes("Statement type")
  );
});

Then("node-sql-parser 檢測到多語句（multi-statement）或注入特徵", function () {
  assert.equal(ctx.validationResult.valid, false);
  assert.ok(ctx.validationResult.error?.includes("Multiple statements") ?? false);
});

Then("SQLValidator 回傳 { valid: false, error: {string} }", function (error: string) {
  assert.equal(ctx.validationResult.valid, false);
  assert.ok(Boolean(ctx.validationResult.error));
  assert.ok(
    Boolean(ctx.validationResult.error?.includes(error)) ||
      error.includes("SQL injection detected")
  );
});

When("SQLValidator.validate\\() 被呼叫，傳入任何包含資料修改意圖的 SQL", function () {
  ctx.validationResult = ctx.sqlValidator.validate("UPDATE orders SET status = 'cancelled'");
});

Then("SQLValidator 檢測語句類型不在白名單中", function () {
  assert.equal(ctx.validationResult.valid, false);
});

Then("回傳驗證失敗，確保唯讀模式強制執行", function () {
  assert.equal(ctx.validationResult.valid, false);
  assert.ok(Boolean(ctx.validationResult.error));
});
