# language: zh-TW
Feature: 稽核日誌（Audit Log）
  作為 系統管理者
  我希望 系統能記錄所有 AI 查詢的稽核日誌
  以便 追蹤與審計 AI 對資料庫的所有存取行為

  Background:
    Given MCP Server 已啟動
    And 設定檔中 audit.enabled 為 true

  Scenario: SQL 查詢成功後自動寫入稽核日誌
    Given AI Client 對連線 "sales-db" 執行了 SQL 查詢 "SELECT * FROM orders"
    When 查詢成功執行並回傳 100 筆結果，耗時 120ms
    Then 系統寫入稽核日誌，包含以下欄位：
      | 欄位             | 範例值                    |
      | timestamp        | 2026-03-04                |
      | connection_name  | sales-db                  |
      | query            | SELECT * FROM orders      |
      | row_count        | 100                       |
      | execution_time   | 120ms                     |
      | client           | （呼叫端識別）            |

  Scenario: MongoDB 查詢成功後自動寫入稽核日誌
    Given AI Client 對 MongoDB 連線執行了查詢
    When 查詢成功執行
    Then 系統寫入稽核日誌，包含 timestamp、connection_name、query、row_count、execution_time、client

  Scenario: 稽核日誌功能停用時不記錄
    Given 設定檔中 audit.enabled 為 false
    When AI Client 執行任何查詢
    Then 系統不寫入稽核日誌

  Scenario: STDIO MCP 模式下仍記錄稽核日誌
    Given MCP Server 以 STDIO 模式啟動
    And 設定檔中 audit.enabled 為 true
    When AI Client 透過 MCP Protocol 執行查詢
    Then 系統仍寫入稽核日誌，記錄完整的查詢資訊
