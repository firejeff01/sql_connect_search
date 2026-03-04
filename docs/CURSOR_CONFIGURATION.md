# Cursor Configuration

This is the recommended Cursor setup for this MCP server on Windows.

Reference source:
- Chrome DevTools MCP client configuration for Cursor: https://github.com/ChromeDevTools/chrome-devtools-mcp

Verified on 2026-03-05. The current guidance for Cursor is to use the standard MCP config in `Cursor Settings -> MCP -> New MCP Server`.

## Recommended Transport

Use local STDIO, not HTTP.

Recommended command:

```text
node D:\workspace\mcp\sql_connect_search\scripts\mcp-stdio-launcher.mjs --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

## Cursor MCP Config

Use this config when Cursor asks for the MCP server definition:

```json
{
  "mcpServers": {
    "sql-connect-search": {
      "command": "node",
      "args": [
        "D:\\workspace\\mcp\\sql_connect_search\\scripts\\mcp-stdio-launcher.mjs",
        "--config",
        "D:\\workspace\\mcp\\sql_connect_search\\config\\shop-mysql.yaml"
      ],
      "env": {
        "MYSQL_LIVE_PASSWORD": "<your_mysql_password>"
      }
    }
  }
}
```

Example file:
- [cursor-mcp.json](/D:/workspace/mcp/sql_connect_search/docs/examples/cursor-mcp.json)

## Recommended For This Repository

This repository now includes a workspace MCP config for Cursor:
- [mcp.json](/D:/workspace/mcp/sql_connect_search/.cursor/mcp.json)

Before opening Cursor, set:

```powershell
$env:MYSQL_LIVE_PASSWORD = '<your_mysql_password>'
```

Then open this project in Cursor.

This is the preferred path because the project carries its own MCP definition and you do not need to re-enter the server by hand.

## Setup Steps

1. Open `Cursor Settings`.
2. Go to `MCP`.
3. Click `New MCP Server`.
4. Paste the config above.
5. Save the server.

If your Cursor build auto-detects workspace MCP config, the project file is enough:
- [mcp.json](/D:/workspace/mcp/sql_connect_search/.cursor/mcp.json)

## First Validation Prompt

In Cursor, ask:

```text
列出目前可用的 MCP tools，然後讀取預設 SQL connection 的 schema overview。
```

Expected MCP flow:

1. `initialize`
2. `tools/list`
3. `roots/list` or `resources/list`
4. `resources/read` on `schema://shop-mysql/overview`

## Troubleshooting

If Cursor shows the server but cannot connect:

1. Confirm `node` is on PATH.
2. Confirm `MYSQL_LIVE_PASSWORD` is either in the MCP config `env` block or already present in the OS environment.
3. Test the command outside Cursor:

```powershell
$env:MYSQL_LIVE_PASSWORD = '<your_mysql_password>'
node D:\workspace\mcp\sql_connect_search\scripts\mcp-stdio-launcher.mjs --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

4. If the command waits with a blinking cursor, that is expected. The server is ready and waiting for an MCP client.
