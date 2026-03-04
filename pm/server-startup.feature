# language: zh-TW
Feature: 伺服器啟動（Server Startup）
  作為 系統管理者
  我希望 能以不同模式啟動 MCP Database Server
  以便 供 AI Client 或內部 AI Service 使用

  Scenario: 以 CLI/MCP 模式啟動
    Given 系統已安裝 mcp-database-server
    And 存在有效的 YAML 設定檔
    When 使用者執行 "mcp-database-server"
    Then 系統載入設定檔
    And 系統註冊所有 MCP Tools：list_connections、describe_tables、query_database、mongodb_query、discover_schema
    And 系統為所有設定的資料庫建立連線池
    And MCP Server 以 STDIO Transport 模式啟動
    And AI Client 可透過 MCP Protocol 呼叫 Tools

  Scenario: CLI/MCP 模式不需要 HTTP 認證但仍執行安全策略
    Given 系統以 CLI/MCP 模式（STDIO）啟動
    When AI Client 透過 MCP Protocol 呼叫 Tools
    Then 系統不要求 HTTP 認證
    And 系統仍執行 query policy 檢查
    And 系統仍執行 limits 限制
    And 系統仍記錄 audit log

  Scenario: 以 HTTP Server 模式啟動（預設綁定 127.0.0.1）
    Given 系統已安裝 mcp-database-server
    And 存在有效的 YAML 設定檔
    When 使用者執行 "mcp-database-server --http --port 3000"
    Then 系統載入設定檔
    And 系統註冊所有 MCP Tools
    And 系統為所有設定的資料庫建立連線池
    And MCP Server 以 HTTP 模式在 port 3000 啟動
    And HTTP Server 預設綁定 127.0.0.1
    And 內部 AI Service 可透過 HTTP 呼叫 Tools

  Scenario: 以 HTTP Server 模式啟動並明確綁定所有介面
    Given 系統已安裝 mcp-database-server
    And 存在有效的 YAML 設定檔
    When 使用者執行 "mcp-database-server --http --port 3000 --bind 0.0.0.0"
    Then MCP Server 以 HTTP 模式在 port 3000 啟動
    And HTTP Server 綁定 0.0.0.0，對所有網路介面開放

  Scenario: MCP Tools 註冊完整性
    Given MCP Server 啟動流程已執行
    When 系統完成 Tool 註冊
    Then 以下 5 個 Tools 已註冊且可被呼叫：
      | Tool             | 說明           |
      | list_connections | 列出資料庫     |
      | describe_tables  | 查詢資料表     |
      | query_database   | SQL 查詢       |
      | mongodb_query    | MongoDB 查詢   |
      | discover_schema  | Schema 探索    |
