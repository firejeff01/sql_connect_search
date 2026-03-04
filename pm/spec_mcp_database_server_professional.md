# MCP Database Server 專業版需求規格書

（Professional MCP Database Server Specification）

版本：1.0\
文件類型：系統需求規格書（System Requirement Specification, SRS）\
語言：中文\
專案類型：GitHub 開源專案

------------------------------------------------------------------------

# 一、專案背景

隨著 **AI Agent / LLM 應用**快速發展，AI
需要能夠即時存取企業資料庫進行分析與決策。

Model Context Protocol（MCP）提供了一個標準方式，使 AI 可以透過 MCP
Server 呼叫外部工具與資料來源。

本專案目標為建立一套 **通用資料庫 MCP Server**，提供 AI Agent
安全、可控、可擴展的資料庫查詢能力。

------------------------------------------------------------------------

# 二、專案目標

建立一個 **專業級 MCP Database Server**，具備以下能力：

1.  支援多種資料庫
2.  AI 安全查詢（SQL 安全解析）
3.  Connection Pool
4.  Schema Discovery
5.  Query Limit Control
6.  Audit Log
7.  MCP Tool Interface
8.  CLI 與 Server 模式
9.  GitHub 開源專案

------------------------------------------------------------------------

# 三、系統架構

    AI Client
    (Claude / Cursor / Codex / Agent)
            │
            │ MCP Protocol
            ▼
    MCP Database Server
            │
            ├── Tool Layer
            │     query_database
            │     list_connections
            │     describe_tables
            │     discover_schema
            │
            ├── Security Layer
            │     SQL Validator
            │     Query Policy
            │
            ├── Service Layer
            │     Query Executor
            │     Schema Service
            │     Limit Controller
            │
            ├── Infrastructure Layer
            │     Connection Manager
            │     Connection Pool
            │     Driver Adapter
            │
            └── Database Layer
                  MSSQL / MySQL / PG / Oracle / MongoDB

------------------------------------------------------------------------

# 四、支援資料庫

  資料庫                 Driver
  ---------------------- ----------
  Microsoft SQL Server   mssql
  MySQL                  mysql2
  PostgreSQL             pg
  Oracle                 oracledb
  MongoDB                mongodb

------------------------------------------------------------------------

# 五、核心功能需求

## 5.1 MCP SDK 整合

系統需使用 **Model Context Protocol SDK** 建立 MCP Server。

需支援：

-   Tool Registration
-   JSON RPC Communication
-   STDIO Transport
-   Client Tool Invocation

------------------------------------------------------------------------

## 5.2 多資料庫 Driver

系統需提供 **Driver Adapter Layer**。

Driver Adapter 負責：

-   建立資料庫連線
-   執行查詢
-   回傳統一格式資料

標準輸出格式

    {
     columns: [],
     rows: []
    }

------------------------------------------------------------------------

## 5.3 Connection Pool

為提升效能，需支援連線池。

需求：

-   每個資料庫獨立 Pool
-   Pool Size 可設定
-   Idle timeout

範例設定

``` yaml
pool:
  max: 10
  min: 2
  idleTimeout: 30000
```

------------------------------------------------------------------------

## 5.4 SQL 安全解析

系統需包含 **SQL Validator**。

Validator 功能：

1.  SQL Parser
2.  Statement Type 檢測
3.  Block Dangerous SQL

允許語句

-   SELECT
-   SHOW
-   DESCRIBE
-   EXPLAIN

禁止語句

-   INSERT
-   UPDATE
-   DELETE
-   DROP
-   ALTER
-   TRUNCATE

------------------------------------------------------------------------

## 5.5 Schema Discovery

AI 需要了解資料庫結構。

系統需提供

### discover_schema

回傳：

    database
    tables
    columns
    types
    indexes
    relationships

------------------------------------------------------------------------

## 5.6 Query Limit Control

為避免 AI 查詢過大資料，需限制：

  限制                 預設值
  -------------------- --------
  Max rows             1000
  Query timeout        30s
  Result size          5MB
  Max execution time   60s

------------------------------------------------------------------------

## 5.7 Audit Log

系統需記錄所有 AI 查詢。

Log 內容：

-   timestamp
-   connection_name
-   query
-   row_count
-   execution_time
-   client

Log example

    {
     time: "2026-03-04",
     connection: "sales-db",
     query: "SELECT * FROM orders",
     rows: 100,
     duration: "120ms"
    }

------------------------------------------------------------------------

# 六、MCP Tools 設計

系統需提供以下 MCP Tools

  Tool               說明
  ------------------ --------------
  list_connections   列出資料庫
  describe_tables    查詢資料表
  query_database     SQL 查詢
  mongodb_query      MongoDB 查詢
  discover_schema    Schema 探索

------------------------------------------------------------------------

# 七、設定檔

使用 YAML 設定。

    connections:

      - name: sales-db
        type: mssql
        host: 10.0.0.10
        port: 1433
        database: sales
        username: ai_reader
        password: password

    limits:
      max_rows: 1000
      timeout: 30

    audit:
      enabled: true

------------------------------------------------------------------------

# 八、系統模式

系統需支援兩種模式

## CLI / MCP 模式

    mcp-database-server

供 AI Client 呼叫

------------------------------------------------------------------------

## HTTP Server 模式

    mcp-database-server --http --port 3000

供內部 AI Service 使用

------------------------------------------------------------------------

# 九、GitHub 專案結構

    mcp-database-server
    │
    ├── src
    │   ├── server
    │   ├── tools
    │   ├── security
    │   ├── database
    │   │   ├── drivers
    │   │   └── pool
    │   ├── schema
    │   └── config
    │
    ├── docs
    │
    ├── examples
    │
    ├── config
    │
    ├── package.json
    ├── tsconfig.json
    ├── README.md
    └── LICENSE

------------------------------------------------------------------------

# 十、效能需求

  指標               需求
  ------------------ --------------
  Query latency      \< 1s
  Concurrent query   50
  Pool connection    configurable

------------------------------------------------------------------------

# 十一、安全需求

系統需提供

-   SQL Injection 防護
-   Query Policy
-   Read Only Enforcement
-   Credential Encryption

------------------------------------------------------------------------

# 十二、開源需求

GitHub 專案需包含

-   README
-   INSTALL GUIDE
-   CONFIG GUIDE
-   SECURITY POLICY
-   CONTRIBUTING

------------------------------------------------------------------------

# 十三、Roadmap

未來版本：

-   Query cache
-   Schema graph
-   AI query planner
-   Query cost analysis
-   Role based access
-   Multi tenant support

------------------------------------------------------------------------

# 十四、專案完成標準

專案完成需符合：

1.  Claude 可以透過 MCP 查詢資料庫
2.  Cursor 可以使用 MCP Tool
3.  Codex CLI 可以呼叫資料庫
4.  支援多資料庫
5.  Schema Discovery 可用
6.  SQL 安全解析可用

------------------------------------------------------------------------
