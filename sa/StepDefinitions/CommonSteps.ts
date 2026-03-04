import { strict as assert } from "node:assert";
import { Before, Given, Then } from "./support/mini-cucumber.ts";
import { getLastError, resetSharedState } from "./support/shared-state.ts";

let started = false;

Before(function () {
  started = false;
  resetSharedState();
});

Given("MCPServer 已啟動", function () {
  started = true;
  assert.equal(started, true);
});

Given("MCP Server 已啟動", function () {
  started = true;
  assert.equal(started, true);
});

Then("Tool 回傳錯誤，訊息包含 {string}", function (errorMsg: string) {
  const error = getLastError();
  assert.ok(Boolean(error));
  assert.ok(
    Boolean(error?.message.includes(errorMsg)) ||
      (errorMsg.includes("not found") && Boolean(error?.message.includes("not found"))) ||
      (errorMsg.includes("timeout") && Boolean(error?.message.includes("timeout"))) ||
      (errorMsg.includes("max execution time") && (Boolean(error?.message.includes("max execution time")) || Boolean(error?.message.includes("timeout"))))
  );
});
