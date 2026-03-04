# MCP Client Configuration

This guide maps this server to the MCP clients listed in the current `chrome-devtools-mcp` "MCP Client configuration" section.

Reference source:
- ChromeDevTools MCP repository: https://github.com/ChromeDevTools/chrome-devtools-mcp

Verified against the repository page on 2026-03-05.

## Prerequisites

Set the MySQL password in your OS environment before starting the client or IDE:

```powershell
$env:MYSQL_LIVE_PASSWORD = '<your_mysql_password>'
```

This project already resolves `${MYSQL_LIVE_PASSWORD}` from:
- [shop-mysql.yaml](/D:/workspace/mcp/sql_connect_search/config/shop-mysql.yaml)
- [shop-mysql-http.yaml](/D:/workspace/mcp/sql_connect_search/config/shop-mysql-http.yaml)

Recommended local launcher:

```powershell
node D:\workspace\mcp\sql_connect_search\scripts\mcp-stdio-launcher.mjs --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

Portable command after `npm link` or package install:

```powershell
sql-connect-search-mcp --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

## Standard Config

Use this standard local MCP config anywhere a client accepts `command`, `args`, and optional `env`.

Portable installed form:

```json
{
  "mcpServers": {
    "sql-connect-search": {
      "command": "sql-connect-search-mcp",
      "args": [
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

Repository-local form:

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

## Client Matrix

### Amp

Use the standard config above, or add it with the CLI:

```powershell
amp mcp add sql-connect-search -- sql-connect-search-mcp --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

### Antigravity

If Antigravity expects a browser-bound MCP server, follow its custom MCP install flow and use:

```json
{
  "mcpServers": {
    "sql-connect-search": {
      "command": "sql-connect-search-mcp",
      "args": [
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

Unlike `chrome-devtools-mcp`, this server does not require a `--browser-url` argument.

### Claude Code

Dedicated setup guide:
- [CLAUDE_CODE_CONFIGURATION.md](/D:/workspace/mcp/sql_connect_search/docs/CLAUDE_CODE_CONFIGURATION.md)

```powershell
claude mcp add sql-connect-search --scope user -- sql-connect-search-mcp --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

### Cline

Use the standard config above.

### Codex

Dedicated setup guide:
- [CODEX_CLI_CONFIGURATION.md](/D:/workspace/mcp/sql_connect_search/docs/CODEX_CLI_CONFIGURATION.md)

Use the standard config above, or add it with:

```powershell
codex mcp add sql-connect-search -- sql-connect-search-mcp --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

If the host requires a shell wrapper on Windows, use:

```toml
[mcp_servers.sql-connect-search]
command = "cmd"
args = [
  "/c",
  "sql-connect-search-mcp",
  "--config",
  "D:\\workspace\\mcp\\sql_connect_search\\config\\shop-mysql.yaml",
]
env = { MYSQL_LIVE_PASSWORD = "<your_mysql_password>" }
startup_timeout_ms = 20000
```

### Copilot CLI

In the interactive MCP add flow, use this local command:

```text
sql-connect-search-mcp --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

### Copilot / VS Code

Dedicated setup guide:
- [VSCODE_COPILOT_CONFIGURATION.md](/D:/workspace/mcp/sql_connect_search/docs/VSCODE_COPILOT_CONFIGURATION.md)

Use the standard config above.

### Cursor

Dedicated setup guide:
- [CURSOR_CONFIGURATION.md](/D:/workspace/mcp/sql_connect_search/docs/CURSOR_CONFIGURATION.md)

Use the standard config above.

### Factory CLI

```powershell
droid mcp add sql-connect-search "sql-connect-search-mcp --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml"
```

### Gemini CLI

Project scoped:

```powershell
gemini mcp add sql-connect-search sql-connect-search-mcp --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

User scoped:

```powershell
gemini mcp add -s user sql-connect-search sql-connect-search-mcp --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

### Gemini Code Assist

Use the standard config above.

### JetBrains AI Assistant

Use the standard config above in `Settings | Tools | AI Assistant | Model Context Protocol (MCP)`.

### JetBrains Junie

Use the standard config above in `Settings | Tools | Junie | MCP Settings`.

### Kiro

Use the standard config above.

### Katalon Studio

Katalon Studio currently expects an MCP proxy for HTTP transport. Use the built-in HTTP mode from this project instead of STDIO:

Step 1. Start the server in HTTP mode:

```powershell
$env:MYSQL_LIVE_PASSWORD = '<your_mysql_password>'
sql-connect-search-mcp --config D:\workspace\mcp\sql_connect_search\config\shop-mysql-http.yaml --http --port 3100
```

Step 2. In Katalon Studio / StudioAssist, add the server with:

- Connection URL: `http://127.0.0.1:3100/mcp`
- Transport type: `HTTP`
- Authorization header: `Bearer shop-demo-key`

### OpenCode

Use this `opencode.json` snippet:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "sql-connect-search": {
      "type": "local",
      "command": [
        "sql-connect-search-mcp",
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

### Qoder

Use the standard config above.

### Qoder CLI

Project scoped:

```powershell
qodercli mcp add sql-connect-search -- sql-connect-search-mcp --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

User scoped:

```powershell
qodercli mcp add -s user sql-connect-search -- sql-connect-search-mcp --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

### Visual Studio

Use the standard config above.

### Warp

Use the standard config above.

### Windsurf

Use the standard config above.

## Compatibility Notes

- The launcher script avoids requiring clients to pass `--experimental-strip-types` directly.
- After `npm link`, clients can call `sql-connect-search-mcp` without hard-coding the repository script path.
- This server is currently best integrated over STDIO for desktop MCP clients and AI IDEs.
- HTTP mode is available and is the preferred path for tools such as Katalon Studio that expect an MCP proxy or direct HTTP endpoint.
- If a client cannot store secrets in config, set `MYSQL_LIVE_PASSWORD` in the OS environment before launching that client.

## Validation

You can test the exact launcher outside any client first:

```powershell
$env:MYSQL_LIVE_PASSWORD = '<your_mysql_password>'
sql-connect-search-mcp --config D:\workspace\mcp\sql_connect_search\config\shop-mysql.yaml
```

If you have not run `npm link`, fall back to the repository-local launcher command shown earlier in this guide.

Then send:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"manual-test","version":"1.0.0"}}}
```
