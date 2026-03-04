# SQL Connect Search MCP

Minimal MCP-style database server for read-only SQL and MongoDB access.

Current status:
- `initialize`
- `ping`
- `roots/list`
- `tools/list`
- `tools/call`
- `resources/list`
- `resources/read`
- `prompts/list`
- `prompts/get`
- STDIO transport
- HTTP transport
- JSON-RPC notifications without response bodies
- Real MySQL support via `mysql2`
- Tool input and output schema metadata
- Feature-driven local test runner for `sa/*.feature`

## Available Tools

### `list_connections`
Lists configured database connections.

### `describe_tables`
Describes one table.

Required arguments:
- `connection_name`
- `table_name`

### `query_database`
Executes read-only SQL.

Required arguments:
- `query`

Optional arguments:
- `connection_name`
- `limit`
- `timeout_ms`

Allowed SQL:
- `SELECT`
- `SHOW`
- `DESCRIBE`
- `EXPLAIN`

### `mongodb_query`
Executes read-only MongoDB operations.

Required arguments:
- `collection`

Optional arguments:
- `connection_name`
- `operation`
- `filter`
- `pipeline`
- `limit`
- `timeout_ms`

### `discover_schema`
Returns a schema overview.

Required arguments:
- `connection_name`

Optional arguments:
- `include_patterns`
- `exclude_patterns`
- `depth`

## Available Resources

### `schema://<connection_name>/overview`
Returns a cached schema overview for one configured connection as JSON text.
Includes metadata such as root origin, cache status, generated time, and expiry time.

### `template://query_database/select_top_rows`
Returns a suggested `query_database` call template.

### `template://describe_tables/inspect_table`
Returns a suggested `describe_tables` call template.

### `template://discover_schema/overview`
Returns a suggested `discover_schema` call template.
Template resources include static metadata showing they come from `root://resources`.

## Available Roots

### `root://connections`
Top-level entry for configured database connections.

### `root://connections/<connection_name>`
Top-level entry for one connection and its related schema/query resources.
Includes metadata such as database type, database name, related schema resource URIs, and suggested tools.

### `root://resources`
Top-level entry for schema snapshots and reusable templates.

### `root://prompts`
Top-level entry for reusable prompt templates.

## Available Prompts

### `plan_schema_exploration`
Guides the model to inspect schema resources before executing tools.

### `draft_safe_sql_query`
Guides the model to draft a safe `query_database` call for one table and user goal.

### `choose_best_tool`
Guides the model to select the next MCP method from the current user goal.

## Start

Install dependencies:

```powershell
npm install
```

Build the published `dist/` output:

```powershell
npm run build
```

Install a portable CLI command for this machine:

```powershell
npm link
```

Run tests:

```powershell
npm test
```

Preview what would be published:

```powershell
npm run pack:check
```

## MySQL Demo

Local STDIO/MySQL demo:

```powershell
$env:MYSQL_LIVE_PASSWORD='your-password'
npm run demo:mysql-live
```

Local HTTP/MySQL demo:

```powershell
$env:MYSQL_LIVE_PASSWORD='your-password'
npm run demo:mysql-http
```

Configs:
- [shop-mysql.yaml](/D:/workspace/mcp/sql_connect_search/config/shop-mysql.yaml)
- [shop-mysql-http.yaml](/D:/workspace/mcp/sql_connect_search/config/shop-mysql-http.yaml)

Client-specific configuration examples:
- [MCP_CLIENT_CONFIGURATION.md](/D:/workspace/mcp/sql_connect_search/docs/MCP_CLIENT_CONFIGURATION.md)
- [CLAUDE_CODE_CONFIGURATION.md](/D:/workspace/mcp/sql_connect_search/docs/CLAUDE_CODE_CONFIGURATION.md)
- [CODEX_CLI_CONFIGURATION.md](/D:/workspace/mcp/sql_connect_search/docs/CODEX_CLI_CONFIGURATION.md)
- [CURSOR_CONFIGURATION.md](/D:/workspace/mcp/sql_connect_search/docs/CURSOR_CONFIGURATION.md)
- [VSCODE_COPILOT_CONFIGURATION.md](/D:/workspace/mcp/sql_connect_search/docs/VSCODE_COPILOT_CONFIGURATION.md)
- [MCP_VALIDATION_CHECKLIST.md](/D:/workspace/mcp/sql_connect_search/docs/MCP_VALIDATION_CHECKLIST.md)

## STDIO Usage

Portable command after `npm link` or global install:

```powershell
$env:MYSQL_LIVE_PASSWORD='your-password'
sql-connect-search-mcp --config config/shop-mysql.yaml
```

Repository-local command:

```powershell
$env:MYSQL_LIVE_PASSWORD='your-password'
$env:SQL_CONNECT_SEARCH_DEV='1'
npm run mcp -- --config config/shop-mysql.yaml
```

Send request on stdin:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
```

Example `tools/list`:

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
```

`tools/list` returns both `inputSchema` and `outputSchema` for each tool.

Example `ping`:

```json
{"jsonrpc":"2.0","id":2,"method":"ping","params":{}}
```

Example `roots/list`:

```json
{"jsonrpc":"2.0","id":3,"method":"roots/list","params":{}}
```

`roots/list` returns metadata to help the client choose the next safe action:
- `metadata.kind`
- `metadata.preferred`
- `metadata.connection`
- `metadata.related`
- `metadata.hints`

Example `resources/list`:

```json
{"jsonrpc":"2.0","id":4,"method":"resources/list","params":{}}
```

Example `resources/read`:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "resources/read",
  "params": {
    "uri": "schema://shop-mysql/overview"
  }
}
```

Example `prompts/list`:

```json
{"jsonrpc":"2.0","id":5,"method":"prompts/list","params":{}}
```

Example `prompts/get`:

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "prompts/get",
  "params": {
    "name": "draft_safe_sql_query",
    "arguments": {
      "connection_name": "shop-mysql",
      "table_name": "shop_car",
      "user_goal": "find the latest 5 records"
    }
  }
}
```

Example notification:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized",
  "params": {}
}
```

Example `tools/call` for SQL:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "query_database",
    "arguments": {
      "connection_name": "shop-mysql",
      "query": "SELECT * FROM `shop_car` LIMIT 5"
    },
    "client": "manual-client"
  }
}
```

## HTTP Usage

Start HTTP server:

```powershell
$env:MYSQL_LIVE_PASSWORD='your-password'
sql-connect-search-mcp --config config/shop-mysql-http.yaml --http --port 3100
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:3100/health
```

Initialize:

```powershell
$headers = @{
  Authorization = 'Bearer shop-demo-key'
  'Content-Type' = 'application/json'
}

$body = @{
  jsonrpc = '2.0'
  id = 1
  method = 'initialize'
  params = @{}
} | ConvertTo-Json -Depth 10

Invoke-RestMethod http://127.0.0.1:3100/mcp -Method Post -Headers $headers -Body $body
```

Query MySQL:

```powershell
$headers = @{
  Authorization = 'Bearer shop-demo-key'
  'Content-Type' = 'application/json'
}

$body = @{
  jsonrpc = '2.0'
  id = 2
  method = 'tools/call'
  params = @{
    name = 'query_database'
    arguments = @{
      connection_name = 'shop-mysql'
      query = 'SELECT * FROM `shop_car` LIMIT 5'
    }
    client = 'powershell-demo'
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod http://127.0.0.1:3100/mcp -Method Post -Headers $headers -Body $body
```

Read schema resource:

```powershell
$body = @{
  jsonrpc = '2.0'
  id = 3
  method = 'resources/read'
  params = @{
    uri = 'schema://shop-mysql/overview'
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod http://127.0.0.1:3100/mcp -Method Post -Headers $headers -Body $body
```

`resources/list` and `resources/read` return metadata to help the client decide whether the content can be used directly:
- `annotations.origin`
- `annotations.cache`
- `contents[].metadata.cacheStatus`
- `contents[].metadata.generatedAt`
- `contents[].metadata.expiresAt`

## Protocol Shape

### Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "query_database",
    "arguments": {
      "connection_name": "shop-mysql",
      "query": "SELECT * FROM `shop_car` LIMIT 5"
    },
    "client": "example-client"
  }
}
```

### Success Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "toolName": "query_database",
    "metadata": {
      "durationMs": 12,
      "generatedAt": "2026-03-04T12:00:00.000Z"
    },
    "content": [
      {
        "type": "json",
        "json": {}
      }
    ]
  }
}
```

### Initialize Response Notes

- `protocolVersion` now echoes the negotiated MCP protocol version in standard MCP style
- custom negotiation details are exposed under `_meta`
- `_meta.acceptedProtocolVersion` echoes the client-requested protocol version when supplied
- `_meta.acknowledgedClientInfo` echoes `clientInfo`
- `_meta.acknowledgedClientCapabilities` echoes the client capability block
- `_meta.compatibilityProfile` classifies the host as `claude_desktop`, `openai`, or `generic`
- `_meta.negotiatedCapabilities` declares the actual server-side result of capability negotiation

### Notification Behavior

- STDIO notifications produce no output line
- HTTP notifications return `202 Accepted` with an empty body

### Prompt Get Response

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "description": "Suggest how to draft a read-only SQL tool call.",
    "messages": [
      {
        "role": "system",
        "content": {
          "type": "text",
          "text": "Draft a tools/call request for query_database."
        }
      }
    ]
  }
}
```

### Resource Read Response

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "contents": [
      {
        "uri": "schema://shop-mysql/overview",
        "mimeType": "application/json",
        "metadata": {
          "origin": "root://connections/shop-mysql",
          "root": "root://connections/shop-mysql",
          "cacheStatus": "disk",
          "generatedAt": "2026-03-05T10:00:00.000Z",
          "expiresAt": "2026-03-05T10:10:00.000Z"
        },
        "text": "{\n  \"connection\": \"shop-mysql\"\n}"
      }
    ]
  }
}
```

### Error Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32003,
    "message": "SQL statement 'drop' is not allowed",
    "data": {
      "category": "policy_violation",
      "retryable": false,
      "source": "server"
    }
  }
}
```

### Error Categories

- `-32600` / `invalid_request`: malformed JSON-RPC request
- `-32601` / `not_found`: unknown method or route
- `-32602` / `invalid_params`: missing or malformed parameters
- `-32001` / `unauthorized`: missing or invalid auth
- `-32003` / `policy_violation`: blocked by SQL or Mongo safety policy
- `-32004` / `not_found`: missing tool, prompt, resource, connection, or table
- `-32005` / `unsupported`: method or backend capability is unsupported
- `-32029` / `rate_limited`: request rejected by rate limit
- `-32050` / `not_ready`: server is not initialized or missing required runtime setup
- `-32000` / `internal`: unexpected server failure

## Current Gaps

- Not a full MCP spec implementation yet
- MongoDB transport path is protocol-ready, but only MySQL has real live-driver verification in this repo

## Packaging Notes

- `sql-connect-search-mcp` is the published CLI name exposed from `package.json`
- the bin entry points to [mcp-stdio-launcher.mjs](/D:/workspace/mcp/sql_connect_search/scripts/mcp-stdio-launcher.mjs)
- the published package runs from `dist/`, while local repo development can opt into source mode with `SQL_CONNECT_SEARCH_DEV=1`
- clients can use the portable command after `npm link`, local install, or npm/GitHub package install
- workspace files such as [.vscode/mcp.json](/D:/workspace/mcp/sql_connect_search/.vscode/mcp.json) and [.cursor/mcp.json](/D:/workspace/mcp/sql_connect_search/.cursor/mcp.json) remain repo-local examples and still use the in-repo path

## Git Install Flow

If someone installs from the GitHub repository instead of npm:

```powershell
git clone https://github.com/firejeff01/sql_connect_search.git
cd sql_connect_search
npm install
npm link
```

`npm install` runs `prepare`, so `dist/` is built automatically before `npm link`.

## NPM Publish Checklist

```powershell
npm login
npm test
npm run pack:check
npm publish
```

After publish, clients can use:

```powershell
npx sql-connect-search-mcp@latest --config <path-to-config>
```

## Recommended Next Steps

1. Add root-change notifications or richer root metadata if the target AI host relies on dynamic root discovery.
2. Expand persisted resource catalogs beyond schema snapshots, for example saved query templates or curated views.
3. Add more MCP methods such as sampling or host-specific capability negotiation if the target AI host expects them.
