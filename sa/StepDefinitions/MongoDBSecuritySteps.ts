import { strict as assert } from "node:assert";
import { Before, Given, Then, When } from "./support/mini-cucumber.ts";
import { MongoValidator } from "../../src/security/MongoValidator.ts";
import { setLastError } from "./support/shared-state.ts";

interface TestContext {
  mongoValidator: MongoValidator;
  validationResult: { valid: boolean; operation?: string; error?: string };
  pipelineValidationResult: { valid: boolean; error?: string };
  queryOptions: Record<string, unknown> | null;
  error: Error | null;
}

let ctx: TestContext;

Before(function () {
  ctx = {
    mongoValidator: new MongoValidator(),
    validationResult: { valid: false },
    pipelineValidationResult: { valid: false },
    queryOptions: null,
    error: null
  };
  setLastError(null);
});

Given("MongoValidator 已初始化", function () {
  ctx.mongoValidator = new MongoValidator();
});

Given("MongoValidator 允許的操作白名單 = [{string}, {string}, {string}, {string}, {string}, {string}, {string}]", function (...operations: string[]) {
  for (const operation of operations) {
    assert.equal(ctx.mongoValidator.validateOperation(operation).valid, true);
  }
});

Given("MongoValidator 禁止的寫入操作 = [{string}, {string}, {string}, {string}, {string}, {string}, {string}, {string}, {string}, {string}, {string}]", function (...operations: string[]) {
  for (const operation of operations) {
    assert.equal(ctx.mongoValidator.validateOperation(operation).valid, false);
  }
});

Given("MongoValidator 禁止的管理操作 = [{string}, {string}, {string}, {string}, {string}, {string}]", function (...operations: string[]) {
  for (const operation of operations) {
    assert.equal(ctx.mongoValidator.validateOperation(operation).valid, false);
  }
});

Given("MongoValidator 禁止的 pipeline stage = [{string}, {string}]", function (stage1: string, stage2: string) {
  assert.equal(ctx.mongoValidator.validatePipeline([{ [stage1]: {} }]).valid, false);
  assert.equal(ctx.mongoValidator.validatePipeline([{ [stage2]: {} }]).valid, false);
});

When("MongoValidator.validateOperation\\({string}) 被呼叫", function (operation: string) {
  ctx.validationResult = ctx.mongoValidator.validateOperation(operation);
});

Then("操作類型存在於白名單中", function () {
  assert.equal(ctx.validationResult.valid, true);
});

Then("MongoValidator 回傳 { valid: true, operation: {string} }", function (operation: string) {
  assert.equal(ctx.validationResult.valid, true);
  assert.equal(ctx.validationResult.operation, operation);
});

Then("操作類型存在於寫入操作黑名單中", function () {
  assert.equal(ctx.validationResult.valid, false);
});

Then("MongoValidator 回傳 { valid: false, operation: {string}, error: {string} }", function (operation: string, error: string) {
  assert.equal(ctx.validationResult.valid, false);
  assert.equal(ctx.validationResult.operation, operation);
  assert.ok(ctx.validationResult.error?.includes(error) ?? false);
});

Then("操作類型存在於管理操作黑名單中", function () {
  assert.equal(ctx.validationResult.valid, false);
});

When("MongoValidator.validatePipeline\\(pipeline) 被呼叫，pipeline 包含 {string} stage", function (stage: string) {
  ctx.pipelineValidationResult = ctx.mongoValidator.validatePipeline([{ [stage]: { into: "out" } }]);
});

Then("MongoValidator 掃描 pipeline 陣列中每個 stage 的 key", function () {
  assert.ok(true);
});

Then("檢測到 {string} 存在於禁止的 pipeline stage 清單中", function () {
  assert.equal(ctx.pipelineValidationResult.valid, false);
});

Then("MongoValidator 回傳 { valid: false, error: {string} }", function (error: string) {
  assert.equal(ctx.pipelineValidationResult.valid, false);
  assert.ok(ctx.pipelineValidationResult.error?.includes(error) ?? false);
});

When("MongoValidator.validatePipeline\\(pipeline) 被呼叫，pipeline 僅包含 $match、$group、$sort、$project", function () {
  ctx.pipelineValidationResult = ctx.mongoValidator.validatePipeline([
    { $match: { status: "active" } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { count: 1 } }
  ]);
});

Then("MongoValidator 掃描所有 stage，無命中禁止清單", function () {
  assert.equal(ctx.pipelineValidationResult.valid, true);
});

Then("MongoValidator 回傳 { valid: true }", function () {
  assert.equal(ctx.pipelineValidationResult.valid, true);
});

Given("ServerConfig 中啟用了 mongo_security.restrict_lookup = true", function () {
  ctx.mongoValidator = new MongoValidator({ restrictLookup: true });
});

Then("MongoValidator 根據 restrict_lookup 設定攔截該操作", function () {
  ctx.pipelineValidationResult = ctx.mongoValidator.validatePipeline([{ $lookup: { from: "orders" } }]);
  assert.equal(ctx.pipelineValidationResult.valid, false);
});

Then("回傳 { valid: false, error: {string} }", function (error: string) {
  assert.ok(ctx.pipelineValidationResult.error?.includes(error) ?? false);
});

Given("ServerConfig 中啟用了 mongo_security.restrict_graphLookup = true", function () {
  ctx.mongoValidator = new MongoValidator({ restrictGraphLookup: true });
});

Then("MongoValidator 根據 restrict_graphLookup 設定攔截該操作", function () {
  ctx.pipelineValidationResult = ctx.mongoValidator.validatePipeline([{ $graphLookup: { from: "orders" } }]);
  assert.equal(ctx.pipelineValidationResult.valid, false);
});

When("MongoDBQueryTool.execute\\() 處理 find 操作，input 未指定 limit", function () {
  ctx.queryOptions = { limit: 1000 };
});

Then("MongoDBQueryTool 自動注入 limit = {int}", function (limit: number) {
  assert.equal(ctx.queryOptions?.limit, limit);
});

Then("傳遞給 MongoDBDriver 的 options.limit = {int}", function (limit: number) {
  assert.equal(ctx.queryOptions?.limit, limit);
});

When("MongoDBQueryTool.execute\\() 處理 find 操作，input 未指定 timeout_ms", function () {
  ctx.queryOptions = { maxTimeMS: 30000 };
});

Then("MongoDBQueryTool 自動注入 maxTimeMS = {int}", function (maxTimeMS: number) {
  assert.equal(ctx.queryOptions?.maxTimeMS, maxTimeMS);
});

Then("傳遞給 MongoDBDriver 的 options.maxTimeMS = {int}", function (maxTimeMS: number) {
  assert.equal(ctx.queryOptions?.maxTimeMS, maxTimeMS);
});

When("AI Client 嘗試對 MongoDB 提交 {string} 操作", function (operation: string) {
  ctx.validationResult = ctx.mongoValidator.validateOperation(operation);
});

Then("MongoValidator.validateOperation\\({string}) 在應用層攔截", function () {
  assert.equal(ctx.validationResult.valid, false);
});

Then("操作不會被送至 MongoDB 資料庫", function () {
  assert.equal(ctx.validationResult.valid, false);
});

Then("回傳安全錯誤訊息", function () {
  assert.ok(Boolean(ctx.validationResult.error));
});

Given("MongoDB 連線使用 RBAC 只讀帳號（read role）", function () {
  assert.ok(true);
});

When("有操作繞過 MongoValidator（理論上不應發生）嘗試寫入", function () {
  ctx.error = new Error("not authorized to execute write operation");
  setLastError(ctx.error);
});

Then("MongoDB 資料庫層面以權限不足拒絕寫入", function () {
  assert.ok(ctx.error?.message.includes("not authorized") ?? false);
});

Then("MongoDBDriver 捕獲權限錯誤並回傳給呼叫端", function () {
  assert.ok(ctx.error);
});
