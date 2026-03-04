# VS Code / Copilot Configuration

This is the recommended setup for Visual Studio Code and GitHub Copilot style MCP integration on Windows.

Reference source:
- Chrome DevTools MCP client configuration for Copilot / VS Code: https://github.com/ChromeDevTools/chrome-devtools-mcp

Verified on 2026-03-05. The current guidance is:
- follow the MCP install flow with the standard config
- or use the VS Code CLI `code --add-mcp ...`
- workspace-level `.vscode/mcp.json` is the most stable option for this project

## Recommended Transport

Use local STDIO, not HTTP.

Recommended command:

```text
node D:\workspace\mcp\sql_connect_search\scripts\mcp-stdio-launcher.mjs --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

## Standard MCP Config

Use this config when VS Code or a Copilot MCP UI asks for the server definition:

```json
{
  "name": "sql-connect-search",
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
```

Example file:
- [vscode-copilot-mcp.json](/D:/workspace/mcp/sql_connect_search/docs/examples/vscode-copilot-mcp.json)

## Recommended For This Repository

This repository now includes a workspace MCP config:
- [mcp.json](/D:/workspace/mcp/sql_connect_search/.vscode/mcp.json)

That is the preferred VS Code path because it avoids PowerShell JSON quoting issues with `code --add-mcp`.

Before opening VS Code, set the environment variable:

```powershell
$env:MYSQL_LIVE_PASSWORD = '<your_mysql_password>'
```

Then open this workspace in VS Code.

## VS Code CLI Installation

If your local VS Code build supports MCP CLI registration, use:

```powershell
code --add-mcp "{""name"":""sql-connect-search"",""command"":""node"",""args"":[""D:\\workspace\\mcp\\sql_connect_search\\scripts\\mcp-stdio-launcher.mjs"",""--config"",""D:\\workspace\\mcp\\sql_connect_search\\config\\shop-mysql.yaml""],""env"":{""MYSQL_LIVE_PASSWORD"":""<your_mysql_password>""}}"
```

That follows the same model as the `chrome-devtools-mcp` documentation, but points to this MCP server.

If `code --add-mcp` has JSON quoting issues in PowerShell, use the workspace file instead:
- [mcp.json](/D:/workspace/mcp/sql_connect_search/.vscode/mcp.json)

## Manual Setup

If you are configuring MCP through the VS Code UI:

1. Open `Command Palette`.
2. Open the MCP server management / install flow available in your VS Code or Copilot build.
3. Add a local MCP server.
4. Use:
   - `command`: `node`
   - `args`: `D:\workspace\mcp\sql_connect_search\scripts\mcp-stdio-launcher.mjs`, `--config`, `D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml`
   - `env`: `MYSQL_LIVE_PASSWORD=<your_mysql_password>`

## First Validation Prompt

In VS Code / Copilot, ask:

```text
列出目前可用的 MCP tools，然後讀取預設 SQL connection 的 schema overview。
```

Expected MCP flow:

1. `initialize`
2. `tools/list`
3. `roots/list` or `resources/list`
4. `resources/read` on `schema://shop-mysql/overview`

## Troubleshooting

If VS Code or Copilot cannot connect:

1. Confirm `node` is on PATH.
2. Confirm the MCP config includes `MYSQL_LIVE_PASSWORD`, or set it in the OS environment before starting VS Code.
3. Test the command outside VS Code:

```powershell
$env:MYSQL_LIVE_PASSWORD = '<your_mysql_password>'
node D:\workspace\mcp\sql_connect_search\scripts\mcp-stdio-launcher.mjs --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

4. If the command waits with a blinking cursor, that is expected. The server is ready and waiting for an MCP client.
