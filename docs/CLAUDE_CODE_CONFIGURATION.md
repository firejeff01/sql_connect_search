# Claude Code Configuration

This is the recommended first integration target for this MCP server.

## Scope Choice

Use `--scope user` if you want Claude Code to see this server in every workspace.

Use `--scope project` if you want the configuration limited to this repository.

## Recommended Command

Set the password first:

```powershell
$env:MYSQL_LIVE_PASSWORD = '<your_mysql_password>'
```

Optional pre-step if you want to edit the starter config before the first launch:

```powershell
npx sql-connect-search-mcp@latest init
```

Add the MCP server to Claude Code:

```powershell
claude mcp add sql-connect-search --scope user -- npx -y sql-connect-search-mcp@latest
```

If you want project scope instead:

```powershell
claude mcp add sql-connect-search --scope project -- npx -y sql-connect-search-mcp@latest
```

## What This Starts

Claude Code will launch this local STDIO MCP server:

```text
npx -y sql-connect-search-mcp@latest
```

If the default config does not exist yet, the package will create one automatically on first start.

Repository-local fallback if you do not want to `npm link` yet:

```text
node D:\workspace\mcp\sql_connect_search\scripts\mcp-stdio-launcher.mjs --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

## Expected Server Capabilities

After Claude Code connects, this MCP server supports:

- `initialize`
- `ping`
- `roots/list`
- `resources/list`
- `resources/read`
- `prompts/list`
- `prompts/get`
- `tools/list`
- `tools/call`

## First Validation

In Claude Code, ask it to:

```text
List available MCP tools and inspect the schema overview for the default SQL connection.
```

The expected sequence is:

1. `initialize`
2. `roots/list` or `resources/list`
3. `resources/read` on `schema://shop-mysql/overview`
4. optionally `describe_tables` or `query_database`

## Known Good Config Files

- [shop-mysql.yaml](/D:/workspace/mcp/sql_connect_search/config/shop-mysql.yaml)
- [shop-mysql-http.yaml](/D:/workspace/mcp/sql_connect_search/config/shop-mysql-http.yaml)

For Claude Code, prefer the STDIO config:
- [shop-mysql.yaml](/D:/workspace/mcp/sql_connect_search/config/shop-mysql.yaml)

## Troubleshooting

If Claude Code cannot start the server:

1. Confirm `node` is on PATH.
2. Confirm the default config path by running `npx sql-connect-search-mcp@latest config-path`.
3. If the config was auto-created, edit it with your database host, database name, and username.
4. Confirm `MYSQL_LIVE_PASSWORD` is visible in the same shell/session used to launch Claude Code.
5. Run the launcher manually:

```powershell
$env:MYSQL_LIVE_PASSWORD = '<your_mysql_password>'
npx -y sql-connect-search-mcp@latest
```

6. If manual startup works, the remaining issue is usually Claude Code environment inheritance, not the MCP server itself.
