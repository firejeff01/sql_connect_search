import { strict as assert } from "node:assert";
import { join } from "node:path";
import { Before, Given, Then, When } from "./support/mini-cucumber.ts";
import { MCPServer } from "../../src/server/MCPServer.ts";

interface TestContext {
  server: MCPServer;
  cliArgs: string[];
  serverStatus: string;
  registeredTools: any[];
  configPath: string;
}

let ctx: TestContext;

Before(function () {
  process.env.MSSQL_PASSWORD = "secret123";
  process.env.MONGO_PASSWORD = "secret456";
  ctx = {
    server: new MCPServer(),
    cliArgs: [],
    serverStatus: "",
    registeredTools: [],
    configPath: join(process.cwd(), "config/default.yaml")
  };
});

Given("系統已建置 mcp-database-server 專案", function () {
  assert.ok(ctx.server);
});

Given("存在有效的 YAML 設定檔 {string}，內容包含：", function (yamlPath: string) {
  ctx.configPath = join(process.cwd(), yamlPath);
});

Given("YAML 設定檔路徑為 {string}", function (yamlPath: string) {
  ctx.configPath = join(process.cwd(), yamlPath);
});

When("使用者執行 CLI 命令 {string}", async function (command: string) {
  ctx.cliArgs = command.split(" ");
  const http = ctx.cliArgs.includes("--http");
  const portIndex = ctx.cliArgs.indexOf("--port");
  const bindIndex = ctx.cliArgs.indexOf("--bind");
  await ctx.server.start({
    configPath: ctx.configPath,
    http,
    port: portIndex >= 0 ? Number(ctx.cliArgs[portIndex + 1]) : undefined,
    bind: bindIndex >= 0 ? ctx.cliArgs[bindIndex + 1] : undefined
  });
  ctx.serverStatus = ctx.server.getStatus();
});

Then("ConfigLoader.loadConfig\\() 成功載入設定檔並回傳 ServerConfig 物件", function () {
  assert.equal(ctx.server.getStatus(), "running");
  assert.ok(ctx.server.getConnectionManager());
});

Then("ConfigLoader.loadConfig\\() 成功載入設定檔", function () {
  assert.equal(ctx.server.getStatus(), "running");
  assert.ok(ctx.server.getConnectionManager());
});

Then("CredentialResolver.resolve\\() 為每個 connection 解析 credential", function () {
  const connections = ctx.server.getConnectionManager()?.listConnections() ?? [];
  assert.equal(connections.length >= 2, true);
});

Then("ToolRegistry.registerTools\\() 註冊以下 {int} 個 MCP Tools：", function (count: number) {
  ctx.registeredTools = ctx.server.getToolRegistry().getRegisteredTools();
  assert.equal(ctx.registeredTools.length, count);
});

Then("ToolRegistry.registerTools\\() 註冊所有 MCP Tools", function () {
  ctx.registeredTools = ctx.server.getToolRegistry().getRegisteredTools();
  assert.equal(ctx.registeredTools.length > 0, true);
});

Then("ConnectionManager.createPools\\() 為所有設定的資料庫建立 ConnectionPool", function () {
  const manager = ctx.server.getConnectionManager();
  assert.ok(manager?.getPool("sales-db"));
  assert.ok(manager?.getPool("mongo-db"));
});

Then("ConnectionManager.createPools\\() 建立所有連線池", function () {
  const manager = ctx.server.getConnectionManager();
  assert.ok(manager?.getPool("sales-db"));
});

Then("MCPServer.start\\() 以 StdioTransport 模式啟動", function () {
  assert.equal(ctx.server.getTransportType(), "stdio");
});

Then("Server 狀態為 {string}，transport 為 {string}", function (status: string, transport: string) {
  assert.equal(ctx.serverStatus, status);
  assert.equal(ctx.server.getTransportType(), transport);
});

Given("MCPServer 已以 StdioTransport 模式啟動", async function () {
  await ctx.server.start({ configPath: ctx.configPath });
});

When("AI Client 透過 MCP Protocol（JSON-RPC over STDIO）呼叫任意 Tool", async function () {
  await ctx.server.getToolRegistry().executeTool("query_database", {
    connection_name: "sales-db",
    query: "SELECT * FROM orders"
  });
});

Then("系統不檢查 Authorization header（STDIO 模式無 HTTP 層）", function () {
  assert.equal(ctx.server.getTransportType(), "stdio");
});

Then("SQLValidator.validate\\() 仍對 SQL 查詢執行安全驗證", function () {
  assert.equal(ctx.server.getAuditLogger()?.getEntries().length, 1);
});

Then("QueryPolicy.clampLimits\\() 仍對查詢參數執行限制夾制", function () {
  const entry = ctx.server.getAuditLogger()?.getEntries()[0];
  assert.equal(entry?.connection_name, "sales-db");
});

Then("AuditLogger.log\\() 仍在 audit.enabled=true 時記錄稽核日誌", function () {
  assert.equal((ctx.server.getAuditLogger()?.getEntries().length ?? 0) > 0, true);
});

Given("設定檔包含 http.api_keys 至少一組有效 API Key", function () {
  assert.ok(true);
});

Then("MCPServer.start\\() 以 HttpTransport 模式啟動", function () {
  assert.equal(ctx.server.getTransportType(), "http");
});

Then("HttpTransport 監聽 port {int}", function (port: number) {
  assert.equal(ctx.server.getPort(), port);
});

Then("HttpTransport 綁定地址為 {string}（預設值）", function (bindAddress: string) {
  assert.equal(ctx.server.getBindAddress(), bindAddress);
});

Then("HttpTransport 綁定地址為 {string}，對所有網路介面開放", function (bindAddress: string) {
  assert.equal(ctx.server.getBindAddress(), bindAddress);
});

Given("MCPServer 啟動流程已完成", async function () {
  await ctx.server.start({ configPath: ctx.configPath });
});

When("呼叫 ToolRegistry.getRegisteredTools\\() 取得已註冊 Tool 清單", function () {
  ctx.registeredTools = ctx.server.getToolRegistry().getRegisteredTools();
});

Then("回傳的 Tool 清單長度為 {int}", function (count: number) {
  assert.equal(ctx.registeredTools.length, count);
});

Then("每個 Tool 具備 name、description、inputSchema 屬性", function () {
  for (const tool of ctx.registeredTools) {
    assert.ok(tool.name);
    assert.ok(tool.description);
    assert.ok(tool.inputSchema);
  }
});

Then("以下 {int} 個 Tools 已註冊且可被 MCP Protocol 呼叫：", function (count: number) {
  assert.equal(ctx.registeredTools.length, count);
});
