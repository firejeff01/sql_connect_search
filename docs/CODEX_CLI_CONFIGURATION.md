# Codex CLI Configuration

This is the recommended setup for Codex CLI on Windows.

## Verified Local CLI Shape

This project checked the local CLI help on 2026-03-05:

```text
codex mcp add [OPTIONS] <NAME> (--url <URL> | -- <COMMAND>...)
```

Codex CLI also supports:

- `--env KEY=VALUE` for stdio MCP servers
- `codex mcp list`
- `codex mcp get <name>`
- `codex mcp remove <name>`

## Recommended Command

Use the local STDIO launcher:

```text
node D:\workspace\mcp\sql_connect_search\scripts\mcp-stdio-launcher.mjs --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

## Recommended Install Command

Run this in PowerShell:

```powershell
codex mcp add sql-connect-search --env MYSQL_LIVE_PASSWORD=<your_mysql_password> -- node D:\workspace\mcp\sql_connect_search\scripts\mcp-stdio-launcher.mjs --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

If you do not want to store the password in the MCP registration command, set it in the OS environment first:

```powershell
$env:MYSQL_LIVE_PASSWORD = '<your_mysql_password>'
codex mcp add sql-connect-search -- node D:\workspace\mcp\sql_connect_search\scripts\mcp-stdio-launcher.mjs --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

## Validation

List configured Codex MCP servers:

```powershell
codex mcp list
```

Show one server:

```powershell
codex mcp get sql-connect-search
```

Remove and re-add:

```powershell
codex mcp remove sql-connect-search
codex mcp add sql-connect-search --env MYSQL_LIVE_PASSWORD=<your_mysql_password> -- node D:\workspace\mcp\sql_connect_search\scripts\mcp-stdio-launcher.mjs --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

## Config Snippet

If you prefer to document the resulting server shape, use this reference:

```toml
[mcp_servers.sql-connect-search]
command = "node"
args = [
  "D:\\workspace\\mcp\\sql_connect_search\\scripts\\mcp-stdio-launcher.mjs",
  "--config",
  "D:\\workspace\\mcp\\sql_connect_search\\config\\shop-mysql.yaml",
]
env = { MYSQL_LIVE_PASSWORD = "<your_mysql_password>" }
```

Example file:
- [codex-mcp.toml](/D:/workspace/mcp/sql_connect_search/docs/examples/codex-mcp.toml)

## First Validation Prompt

After the server is installed in Codex CLI, start Codex and ask:

```text
列出目前可用的 MCP tools，然後讀取預設 SQL connection 的 schema overview。
```

Expected MCP flow:

1. `initialize`
2. `tools/list`
3. `roots/list` or `resources/list`
4. `resources/read` on `schema://shop-mysql/overview`

## Notes

- Codex CLI supports `--env`, so this client is simpler than Claude Code on Windows.
- For this server, STDIO is the recommended path.
- HTTP mode is available, but not needed for Codex CLI.
