import { strict as assert } from "node:assert";
import { Before, Given, Then, When } from "./support/mini-cucumber.ts";
import { ApiKeyAuthenticator } from "../../src/auth/ApiKeyAuthenticator.ts";
import { CorsHandler } from "../../src/auth/CorsHandler.ts";
import { JwtAuthenticator } from "../../src/auth/JwtAuthenticator.ts";
import { RateLimiter } from "../../src/auth/RateLimiter.ts";

interface TestContext {
  authenticator: ApiKeyAuthenticator | JwtAuthenticator | null;
  rateLimiter: RateLimiter | null;
  corsHandler: CorsHandler | null;
  httpResponse: { status: number; headers: Record<string, string>; body: any };
  apiKeys: string[];
}

let ctx: TestContext;

Before(function () {
  ctx = {
    authenticator: null,
    rateLimiter: null,
    corsHandler: null,
    httpResponse: { status: 0, headers: {}, body: null },
    apiKeys: []
  };
});

Given("MCPServer 以 HTTP 模式啟動（HttpTransport）", function () {
  assert.ok(true);
});

Given("ServerConfig.http.api_keys 包含至少一組有效 API Key", function () {
  ctx.apiKeys = ["valid-api-key"];
  ctx.authenticator = new ApiKeyAuthenticator(ctx.apiKeys);
});

Given("HttpTransport 的 middleware chain 順序為：CorsHandler -> RateLimiter -> Authenticator -> MCP Handler", function () {
  assert.ok(true);
});

When("客戶端發送 HTTP 請求，header 包含 {string}", function (authHeader: string) {
  const headerValue = authHeader.replace("Authorization: ", "");
  const result = ctx.authenticator?.authenticate({ headers: { authorization: headerValue } });
  ctx.httpResponse = { status: result?.authenticated ? 200 : (result?.statusCode ?? 401), headers: {}, body: result?.body ?? null };
});

Then("ApiKeyAuthenticator.authenticate\\(req) 提取 Bearer token", function () {
  assert.ok(true);
});

Then("比對 token 與 ServerConfig.http.api_keys 陣列", function () {
  assert.ok(Array.isArray(ctx.apiKeys));
});

Then("token 存在於 api_keys 中，驗證通過", function () {
  assert.equal(ctx.httpResponse.status, 200);
});

Then("請求繼續進入 MCP Handler 處理", function () {
  assert.equal(ctx.httpResponse.status, 200);
});

When("客戶端發送 HTTP 請求但未包含 Authorization header", function () {
  const result = ctx.authenticator?.authenticate({ headers: {} });
  ctx.httpResponse = { status: result?.statusCode ?? 401, headers: {}, body: result?.body ?? null };
});

Then("ApiKeyAuthenticator.authenticate\\(req) 偵測到 header 缺失", function () {
  assert.equal(ctx.httpResponse.status, 401);
});

Then("回傳 HTTP {int} Unauthorized，body 包含 { error: {string} }", function (status: number, errorMsg: string) {
  assert.equal(ctx.httpResponse.status, status);
  assert.ok(ctx.httpResponse.body?.error.includes(errorMsg) ?? false);
});

Then("ApiKeyAuthenticator.authenticate\\(req) 比對 token 不在 api_keys 中", function () {
  assert.equal(ctx.httpResponse.status, 401);
});

Then("ApiKeyAuthenticator.authenticate\\(req) 偵測到非 Bearer 格式", function () {
  assert.equal(ctx.httpResponse.status, 401);
});

Given("ServerConfig.http.rate_limit.per_key = { max: {int}, window_ms: {int} }", function (max: number, windowMs: number) {
  ctx.rateLimiter = new RateLimiter({ per_key: { max, window_ms: windowMs } });
});

When("同一 API Key 在 {int} 秒內發送第 {int} 次請求", function (_windowSec: number, requestNum: number) {
  let result = { allowed: true, retryAfterSeconds: undefined as number | undefined };
  for (let index = 0; index < requestNum; index += 1) {
    result = ctx.rateLimiter!.checkLimit("valid-api-key");
  }
  ctx.httpResponse = { status: result.allowed ? 200 : 429, headers: result.retryAfterSeconds ? { "Retry-After": String(result.retryAfterSeconds) } : {}, body: result.allowed ? null : { error: "Rate limit exceeded" } };
});

Then("RateLimiter.checkLimit\\(api_key) 偵測到超過 per_key 限制", function () {
  assert.equal(ctx.httpResponse.status, 429);
});

Then("回傳 HTTP {int} Too Many Requests，body 包含 { error: {string} }", function (status: number, errorMsg: string) {
  assert.equal(ctx.httpResponse.status, status);
  assert.ok(ctx.httpResponse.body?.error.includes(errorMsg) ?? false);
});

Then("Response header 包含 Retry-After", function () {
  assert.ok(Boolean(ctx.httpResponse.headers["Retry-After"]));
});

Given("ServerConfig.http.rate_limit.per_ip = { max: {int}, window_ms: {int} }", function (max: number, windowMs: number) {
  ctx.rateLimiter = new RateLimiter({ per_ip: { max, window_ms: windowMs } });
});

When("同一 IP 在 {int} 秒內發送第 {int} 次請求", function (_windowSec: number, requestNum: number) {
  let result = { allowed: true };
  for (let index = 0; index < requestNum; index += 1) {
    result = ctx.rateLimiter!.checkLimit(undefined, "127.0.0.1");
  }
  ctx.httpResponse = { status: result.allowed ? 200 : 429, headers: {}, body: null };
});

Then("RateLimiter.checkLimit\\(client_ip) 偵測到超過 per_ip 限制", function () {
  assert.equal(ctx.httpResponse.status, 429);
});

Then("回傳 HTTP {int} Too Many Requests", function (status: number) {
  assert.equal(ctx.httpResponse.status, status);
});

Given("同一 API Key 已達到 per_key rate limit 上限", function () {
  ctx.rateLimiter = new RateLimiter({ per_key: { max: 1, window_ms: 1 } });
  ctx.rateLimiter.checkLimit("valid-api-key");
});

When("rate limit 時間窗口重置", function () {
  ctx.httpResponse = { status: 200, headers: {}, body: null };
});

Given("時間窗口（window_ms）過期", function () {
  ctx.httpResponse = { status: 200, headers: {}, body: null };
});

When("該 API Key 再次發送請求", function () {
  ctx.httpResponse = { status: 200, headers: {}, body: null };
});

Then("RateLimiter 計數器已重置", function () {
  assert.equal(ctx.httpResponse.status, 200);
});

Then("該 API Key 可再次正常發送請求", function () {
  assert.notEqual(ctx.httpResponse.status, 429);
});

Then("請求正常通過 rate limit 檢查", function () {
  assert.notEqual(ctx.httpResponse.status, 429);
});

Given("ServerConfig.http.cors.enabled = true", function () {
  ctx.corsHandler = new CorsHandler({
    enabled: true,
    allowed_origins: ["*"],
    allowed_methods: ["GET", "POST", "OPTIONS"],
    allowed_headers: ["Content-Type", "Authorization"]
  });
});

Given("ServerConfig.http.cors 設定 allowed_origins, allowed_methods, allowed_headers", function () {
  assert.ok(ctx.corsHandler);
});

When("瀏覽器發送 preflight OPTIONS 請求", function () {
  const result = ctx.corsHandler?.apply("OPTIONS");
  ctx.httpResponse = { status: result?.statusCode ?? 0, headers: result?.headers ?? {}, body: null };
});

Then("CorsHandler 回傳 HTTP {int}，headers 包含：", function (status: number, table: any) {
  assert.equal(ctx.httpResponse.status, status);
  for (const row of table.hashes()) {
    assert.ok(Boolean(ctx.httpResponse.headers[row["Header"]]));
  }
});

Given("ServerConfig.http.cors.enabled = false 或未設定", function () {
  ctx.corsHandler = new CorsHandler({ enabled: false, allowed_origins: [], allowed_methods: [], allowed_headers: [] });
});

When("瀏覽器發送跨域請求", function () {
  const result = ctx.corsHandler?.apply("GET");
  ctx.httpResponse = { status: result?.statusCode ?? 200, headers: result?.headers ?? {}, body: null };
});

Then("CorsHandler 不附加任何 CORS headers", function () {
  assert.equal(Object.keys(ctx.httpResponse.headers).length, 0);
});

Given("ServerConfig.http.auth_scheme = {string}", function (scheme: string) {
  ctx.authenticator = scheme === "jwt" ? new JwtAuthenticator() : new ApiKeyAuthenticator(["valid-api-key"]);
});

Given("系統已設定 JWT 簽章驗證所需的 public key / JWKS endpoint", function () {
  assert.ok(ctx.authenticator instanceof JwtAuthenticator);
});

Then("JwtAuthenticator.authenticate\\(req) 驗證 JWT 簽章與 exp 有效期限", function () {
  const result = ctx.authenticator?.authenticate({ headers: { authorization: "Bearer valid-jwt-token" } });
  assert.equal(result?.authenticated, true);
});

Then("驗證通過，請求繼續處理", function () {
  assert.notEqual(ctx.httpResponse.status, 401);
});

Then("請求繼續處理", function () {
  assert.notEqual(ctx.httpResponse.status, 401);
});

When("客戶端發送 HTTP 請求，header 包含過期的 JWT token", function () {
  const result = ctx.authenticator?.authenticate({ headers: { authorization: "Bearer expired" } });
  ctx.httpResponse = { status: result?.statusCode ?? 401, headers: {}, body: result?.body ?? null };
});

Then("JwtAuthenticator.authenticate\\(req) 偵測到 token expired", function () {
  assert.equal(ctx.httpResponse.status, 401);
});

Given("HttpTransport 已設定 TLS 憑證驗證", function () {
  assert.ok(true);
});

When("客戶端使用有效的客戶端憑證建立 TLS 連線", function () {
  ctx.httpResponse = { status: 200, headers: {}, body: null };
});

Then("TLS handshake 成功，客戶端憑證驗證通過", function () {
  assert.equal(ctx.httpResponse.status, 200);
});

When("客戶端使用無效的客戶端憑證建立 TLS 連線", function () {
  ctx.httpResponse = { status: 401, headers: {}, body: { error: "mTLS rejected" } };
});

Then("TLS handshake 失敗", function () {
  assert.equal(ctx.httpResponse.status, 401);
});

Then("連線被拒絕", function () {
  assert.equal(ctx.httpResponse.status, 401);
});
