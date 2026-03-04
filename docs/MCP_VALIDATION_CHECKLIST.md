# MCP Validation Checklist

Use this checklist to verify the server from the three main clients you are currently targeting:

- Claude Code
- VS Code / Copilot
- Codex CLI

Before testing any client, make sure the password is available in the environment used to launch that client:

```powershell
$env:MYSQL_LIVE_PASSWORD = '<your_mysql_password>'
```

## Shared Expectations

The first useful client interaction should normally cause this MCP flow:

1. `initialize`
2. `tools/list`
3. `roots/list` or `resources/list`
4. `resources/read` on `schema://shop-mysql/overview`

If the client goes straight to SQL before reading schema context, that is still usable, but it is not the safest path.

## Validation Prompt 1

Use this first:

```text
列出目前可用的 MCP tools，然後讀取預設 SQL connection 的 schema overview。
```

Expected outcome:

- The client recognizes MCP tools/resources.
- The schema overview is returned from `schema://shop-mysql/overview`.
- No auth or connection error appears.

## Validation Prompt 2

Use this second:

```text
請先列出可用資料表，然後從第一個資料表抓 5 筆資料。
```

Expected outcome:

- The client either reads the schema resource or calls `discover_schema`.
- Then it uses `query_database`.
- The returned data is read-only tabular output.

## Validation Prompt 3

Use this third:

```text
請描述第一個資料表的欄位、主鍵、索引，然後不要修改任何資料。
```

Expected outcome:

- The client calls `describe_tables`.
- It does not attempt any write operation.
- The response includes columns, primary key, and indexes.

## Claude Code

Pre-check:

```powershell
claude mcp list
```

Expected:

- `sql-connect-search ... ✓ Connected`

Primary reference:
- [CLAUDE_CODE_CONFIGURATION.md](/D:/workspace/mcp/sql_connect_search/docs/CLAUDE_CODE_CONFIGURATION.md)

## VS Code / Copilot

Pre-check:

- Open this repository in VS Code after setting `MYSQL_LIVE_PASSWORD`.
- The workspace MCP config should be picked up from:
  - [.vscode/mcp.json](/D:/workspace/mcp/sql_connect_search/.vscode/mcp.json)

Primary reference:
- [VSCODE_COPILOT_CONFIGURATION.md](/D:/workspace/mcp/sql_connect_search/docs/VSCODE_COPILOT_CONFIGURATION.md)

If VS Code does not see the server:

1. Restart VS Code from the same shell that has `MYSQL_LIVE_PASSWORD`.
2. Confirm the workspace file exists.

## Codex CLI

Pre-check:

```powershell
codex mcp list
codex mcp get sql-connect-search
```

Expected:

- `sql-connect-search` is present
- transport is `stdio`
- `MYSQL_LIVE_PASSWORD` is present in env

Primary reference:
- [CODEX_CLI_CONFIGURATION.md](/D:/workspace/mcp/sql_connect_search/docs/CODEX_CLI_CONFIGURATION.md)

## Failure Signals To Watch

- `Failed to connect`
  Usually startup command or env problem.

- `Environment variable ... is not set`
  The client process does not see `MYSQL_LIVE_PASSWORD`.

- `Tool ... not found`
  The MCP handshake succeeded, but the tool registry or capability path is wrong.

- `policy_violation`
  This is expected if the client tries a write query. It means the safety guard is working.

## What To Send Back

If one client fails, capture:

1. The exact prompt you used.
2. The exact error text.
3. Whether the client showed MCP tools/resources before failing.
