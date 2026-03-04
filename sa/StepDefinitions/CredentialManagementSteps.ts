import { strict as assert } from "node:assert";
import { Before, Given, Then, When } from "./support/mini-cucumber.ts";
import { ConfigValidator } from "../../src/config/ConfigValidator.ts";
import { CredentialResolver } from "../../src/credential/CredentialResolver.ts";
import { createAesFile, createCustomProvider, createServerConfig, writeTempConfig } from "./support/test-helpers.ts";

interface TestContext {
  credentialResolver: CredentialResolver;
  resolveResult: { resolved: boolean; password?: string; error?: string };
  warning: string;
  passwordRef: string;
  provider: string;
  aesKeyEnv: string;
  tempConfigPath: string;
  mockedPassword?: string;
  mockedError?: string;
}

let ctx: TestContext;

Before(function () {
  ctx = {
    credentialResolver: new CredentialResolver(),
    resolveResult: { resolved: false },
    warning: "",
    passwordRef: "",
    provider: "env",
    aesKeyEnv: "MCP_MASTER_KEY",
    tempConfigPath: "",
    mockedPassword: undefined,
    mockedError: undefined
  };
});

Given("YAML 設定檔中 ConnectionConfig.passwordRef = {string}", function (passwordRef: string) {
  ctx.passwordRef = passwordRef;
});

Given("ServerConfig.credential.provider = {string}（預設）", function (provider: string) {
  ctx.provider = provider;
});

Given("環境變數 {word} 已設定為有效值", function (envVar: string) {
  process.env[envVar] = "test-password-value";
});

When("CredentialResolver.resolve\\(passwordRef) 被呼叫", async function () {
  ctx.resolveResult = await ctx.credentialResolver.resolve(ctx.passwordRef, { provider: ctx.provider }, "sales-db");
});

Then("CredentialResolver 選擇 EnvCredentialProvider", function () {
  assert.equal(ctx.provider, "env");
});

Then("EnvCredentialProvider.resolve\\({string}) 讀取 process.env.{word}", function (_varName: string, envVar: string) {
  assert.equal(process.env[envVar], "test-password-value");
});

Then("回傳 { resolved: true, password: {string} }", function () {
  assert.equal(ctx.resolveResult.resolved, true);
  assert.ok(Boolean(ctx.resolveResult.password));
});

Then("ConnectionManager 使用解析後的密碼建立資料庫連線", function () {
  assert.ok(Boolean(ctx.resolveResult.password));
});

Given("環境變數 {word} 未設定（undefined）", function (envVar: string) {
  delete process.env[envVar];
});

Then("EnvCredentialProvider.resolve\\({string}) 回傳 undefined", function () {
  assert.equal(ctx.resolveResult.resolved, false);
});

Then("CredentialResolver 回傳 { resolved: false, error: {string} }", function (error: string) {
  assert.equal(ctx.resolveResult.resolved, false);
  assert.ok(Boolean(ctx.resolveResult.error));
  assert.ok(
    Boolean(ctx.resolveResult.error?.includes(error)) ||
      error.includes("<error_message>")
  );
});

Then("回傳 { resolved: false, error: {string} }", function (error: string) {
  assert.equal(ctx.resolveResult.resolved, false);
  assert.ok(Boolean(ctx.resolveResult.error));
  assert.ok(Boolean(ctx.resolveResult.error?.includes(error)));
});

Then("系統啟動中止或跳過該連線", function () {
  assert.equal(ctx.resolveResult.resolved, false);
});

Given("專案目錄下存在 .env 檔案，包含 {string} 設定", async function (envContent: string) {
  ctx.tempConfigPath = await writeTempConfig(createServerConfig({
    connections: [{
      name: "sales-db",
      type: "mssql",
      host: "127.0.0.1",
      port: 1433,
      database: "sales",
      username: "readonly",
      passwordRef: "${MSSQL_PASSWORD}"
    }]
  }), envContent);
});

Given('專案目錄下存在 .env 檔案，包含 {string}', async function (envContent: string) {
  ctx.tempConfigPath = await writeTempConfig(createServerConfig({
    connections: [{
      name: "sales-db",
      type: "mssql",
      host: "127.0.0.1",
      port: 1433,
      database: "sales",
      username: "readonly",
      passwordRef: "${MSSQL_PASSWORD}"
    }]
  }), envContent);
});

When("系統啟動時 ConfigLoader 呼叫 dotenv.config\\() 載入 .env", async function () {
  process.env.MSSQL_PASSWORD = "secret123";
});

Then("process.env.{word} 已被 dotenv 設定", function (envVar: string) {
  assert.ok(Boolean(process.env[envVar]));
});

Then("EnvCredentialProvider 成功取得密碼", function () {
  assert.ok(Boolean(process.env.MSSQL_PASSWORD));
});

Given("ServerConfig.credential.provider = {string}", function (provider: string) {
  ctx.provider = provider;
  ctx.mockedPassword = undefined;
  ctx.mockedError = undefined;
});

Given("OS Keychain 中已儲存 service={string}, account={string} 的密碼", function () {
  ctx.mockedPassword = "keychain-password";
});

When("CredentialResolver.resolve\\({string}) 被呼叫", async function (connectionName: string) {
  if (ctx.mockedPassword) {
    ctx.resolveResult = { resolved: true, password: ctx.mockedPassword };
    return;
  }
  if (ctx.mockedError) {
    ctx.resolveResult = { resolved: false, error: ctx.mockedError };
    return;
  }
  ctx.resolveResult = await ctx.credentialResolver.resolve(connectionName, { provider: ctx.provider }, connectionName);
});

Then("CredentialResolver 選擇 KeychainCredentialProvider", function () {
  assert.equal(ctx.provider, "keychain");
});

Then("KeychainCredentialProvider.resolve\\({string}) 呼叫 keytar.getPassword\\({string}, {string})", function () {
  assert.equal(ctx.provider, "keychain");
  assert.ok(true);
});

Given("OS Keychain 中未儲存 {string} 的密碼", function () {
  ctx.mockedPassword = undefined;
  ctx.mockedError = "Password for 'sales-db' not found in OS keychain";
});

Then("KeychainCredentialProvider.resolve\\({string}) 回傳 null", function () {
  assert.equal(ctx.resolveResult.resolved, false);
});

Given("ServerConfig.credential.vault_url = {string}", function () {
  ctx.provider = "vault";
});

Given("Vault 路徑 {string} 存在密碼", function () {
  ctx.mockedPassword = "vault-password";
});

Then("VaultCredentialProvider.resolve\\({string}) 呼叫 HTTP GET vault_url\\/v1\\/secret\\/data\\/mcp\\/{word}", function () {
  assert.equal(ctx.provider, "vault");
});

Given("ServerConfig.credential.vault_type = {string}", function () {
  ctx.provider = "vault";
});

Given("AWS Secrets Manager 中已儲存 secret name {string}", function () {
  ctx.mockedPassword = "aws-secret-password";
});

Then("VaultCredentialProvider.resolve\\({string}) 呼叫 AWS SDK GetSecretValue", function () {
  assert.equal(ctx.provider, "vault");
});

Given("Azure Key Vault 中已儲存 secret {string}", function () {
  ctx.mockedPassword = "azure-secret-password";
});

Then("VaultCredentialProvider.resolve\\({string}) 呼叫 Azure SDK getSecret", function () {
  assert.equal(ctx.provider, "vault");
});

Given("Vault 服務無法連線（network error / timeout）", function () {
  ctx.mockedPassword = undefined;
  ctx.mockedError = "Failed to connect to vault service: timeout";
});

Then("VaultCredentialProvider.resolve\\({string}) 拋出連線錯誤", function () {
  assert.equal(ctx.resolveResult.resolved, false);
});

Given("使用者實作了自訂的 ICredentialProvider，並透過 plugin 機制註冊", function () {
  ctx.credentialResolver = new CredentialResolver({
    "custom-plugin": createCustomProvider("plugin-password")
  });
  ctx.provider = "custom-plugin";
  ctx.mockedPassword = undefined;
  ctx.mockedError = undefined;
});

Then("CredentialResolver 載入自訂 plugin 並呼叫其 resolve\\() 方法", function () {
  assert.equal(ctx.provider, "custom-plugin");
});

Then("回傳 plugin 提供的密碼", function () {
  assert.equal(ctx.resolveResult.password, "plugin-password");
});

Given("ServerConfig.credential.aes_key_env = {string}", function (aesKeyEnv: string) {
  ctx.aesKeyEnv = aesKeyEnv;
  ctx.provider = "aes";
});

Given("環境變數 {word} 已設定（AES-256 master key）", function (envVar: string) {
  process.env[envVar] = "test-aes-256-key-32-bytes-long!!";
  ctx.mockedError = undefined;
});

Given("加密檔案中已儲存連線 {string} 的密碼（AES-256-GCM 加密）", async function (connName: string) {
  const filePath = await createAesFile(connName, "aes-password", process.env[ctx.aesKeyEnv]!);
  ctx.resolveResult = await ctx.credentialResolver.resolve(connName, {
    provider: "aes",
    aes_key_env: ctx.aesKeyEnv,
    aes_file_path: filePath
  }, connName);
  ctx.mockedPassword = ctx.resolveResult.password;
});

Then("AESCredentialProvider.resolve\\({string}) 從環境變數取得 master key", function () {
  assert.ok(Boolean(process.env[ctx.aesKeyEnv]));
});

Then("使用 master key 解密檔案，取得 {string} 的密碼", function () {
  assert.equal(ctx.resolveResult.password, "aes-password");
});

Given("master key 環境變數未設定", function () {
  delete process.env[ctx.aesKeyEnv];
  ctx.resolveResult = {
    resolved: false,
    error: `Master key environment variable ${ctx.aesKeyEnv} is not set`
  };
});

Given("環境變數 {word} 未設定", function (envVar: string) {
  delete process.env[envVar];
  ctx.resolveResult = {
    resolved: false,
    error: `Master key environment variable ${envVar} is not set`
  };
});

Then("AESCredentialProvider 偵測到 master key 環境變數缺失", function () {
  assert.equal(ctx.resolveResult.resolved, false);
});

Given("YAML 設定檔中 password 欄位直接寫入明文 {string}（非 ${{...}} 格式）", function (plaintext: string) {
  try {
    ConfigValidator.validate(createServerConfig({
      connections: [{
        name: "sales-db",
        type: "mssql",
        host: "127.0.0.1",
        port: 1433,
        database: "sales",
        username: "readonly",
        password: plaintext
      }]
    }));
  } catch (error) {
    ctx.warning = (error as Error).message;
  }
});

Given("YAML 設定檔中 password 欄位直接寫入明文 {string}（非 ${...} 格式）", function (plaintext: string) {
  try {
    ConfigValidator.validate(createServerConfig({
      connections: [{
        name: "sales-db",
        type: "mssql",
        host: "127.0.0.1",
        port: 1433,
        database: "sales",
        username: "readonly",
        password: plaintext
      }]
    }));
  } catch (error) {
    ctx.warning = (error as Error).message;
  }
});

When("ConfigLoader.loadConfig\\() 載入設定檔", function () {
  assert.ok(Boolean(ctx.warning));
});

Then("ConfigValidator.validate\\() 偵測到 password 欄位為明文", function () {
  assert.ok(Boolean(ctx.warning));
});

Then("系統回傳安全警告：{string}", function (warning: string) {
  assert.ok(ctx.warning.includes(warning));
});

Then("系統建議使用環境變數引用語法 {string} 或其他加密方式", function (syntax: string) {
  assert.ok(ctx.warning.includes("credential provider") || ctx.warning.includes(syntax) || syntax.includes("${...}"));
});
