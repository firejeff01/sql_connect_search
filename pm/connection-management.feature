# language: zh-TW
Feature: 連線管理（Connection Management）
  作為 AI Client
  我希望 能列出與管理所有已設定的資料庫連線
  以便 知道有哪些資料庫可供查詢

  Background:
    Given 系統已載入 YAML 設定檔，包含以下連線設定：
      | name     | type  | host      | port | database |
      | sales-db | mssql | 10.0.0.10 | 1433 | sales    |

  Scenario: 成功列出所有資料庫連線
    Given MCP Server 已啟動且 Tools 已註冊
    When AI Client 呼叫 list_connections Tool
    Then 系統回傳所有已設定的資料庫連線清單
    And 每筆連線包含 name、type、host、port、database 資訊

  Scenario: 系統啟動時自動建立連線池
    Given YAML 設定檔已載入，包含連線池設定 max=10、min=2、idleTimeout=30000
    When 系統完成設定檔載入
    Then 系統為每個設定的資料庫自動建立獨立的連線池
    And 連線池大小依設定值初始化

  Scenario: 連線池閒置超時自動銷毀
    Given 資料庫連線池已建立，idleTimeout 設定為 30000 毫秒
    When 連線池閒置時間超過 30000 毫秒
    Then 系統自動銷毀該閒置連線池

  Scenario: 設定檔載入成功
    Given 系統啟動時指定了有效的 YAML 設定檔路徑
    When 系統讀取設定檔
    Then 系統成功解析連線設定、限制設定、稽核設定
    And 產生 ConfigLoaded 事件

  Scenario: 使用 connection_name 指定查詢連線
    Given MCP Server 已啟動且 Tools 已註冊
    And 設定檔包含連線 "sales-db" 與 alias "prod_sales_ro"
    When AI Client 呼叫查詢工具並傳入 connection_name "sales-db"
    Then 系統使用 "sales-db" 對應的連線執行操作

  Scenario: 使用 alias 指定查詢連線
    Given MCP Server 已啟動且 Tools 已註冊
    And 設定檔包含連線 "sales-db" 與 alias "prod_sales_ro"
    When AI Client 呼叫查詢工具並傳入 connection_name "prod_sales_ro"
    Then 系統將 alias "prod_sales_ro" 解析為 "sales-db" 連線並執行操作

  Scenario: 未傳入 connection_name 時拒絕請求
    Given MCP Server 已啟動且 Tools 已註冊
    And 系統未設定 default_connection
    When AI Client 呼叫查詢工具但未傳入 connection_name
    Then 系統拒絕請求並回傳錯誤訊息，提示 connection_name 為必填參數

  Scenario: dev 環境使用 default_connection
    Given MCP Server 已啟動且 Tools 已註冊
    And 設定檔中設定 default_connection 為 "sales-db"
    When AI Client 呼叫查詢工具但未傳入 connection_name
    Then 系統使用 default_connection "sales-db" 執行操作

  Scenario: 查詢連線能力（capabilities）
    Given MCP Server 已啟動且 Tools 已註冊
    And 資料庫連線 "sales-db" 已建立
    When AI Client 查詢連線 "sales-db" 的 capabilities
    Then 系統回傳該連線的能力資訊，包含：
      | 項目              |
      | 支援的 tool 清單  |
      | read-only 狀態    |
      | 最大 rows         |
      | 允許的 schema     |

  Scenario: 使用者傳入的 limit 受 server 上限夾制
    Given MCP Server 已啟動且 Tools 已註冊
    And 系統設定 server 上限 max_rows 為 1000
    When AI Client 呼叫查詢工具並傳入 limit 為 5000
    Then 系統將實際 limit 夾制為 server 上限 1000

  Scenario: 使用者傳入的 timeout_ms 受 server 上限夾制
    Given MCP Server 已啟動且 Tools 已註冊
    And 系統設定 server 上限 timeout 為 30000 毫秒
    When AI Client 呼叫查詢工具並傳入 timeout_ms 為 60000
    Then 系統將實際 timeout_ms 夾制為 server 上限 30000
