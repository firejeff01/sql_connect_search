# language: zh-TW
Feature: Schema 探索（Schema Discovery）
  作為 AI Client
  我希望 能探索資料庫結構
  以便 了解有哪些資料表、欄位與關聯，作為查詢的依據

  Background:
    Given MCP Server 已啟動且 Tools 已註冊
    And 資料庫連線 "sales-db" 已建立連線池

  # === describe_tables：單表、全細節 ===

  Scenario: describe_tables 成功回傳單一資料表完整結構
    Given AI Client 指定連線 "sales-db"
    When AI Client 呼叫 describe_tables Tool 並傳入 connection_name "sales-db" 與 table_name "orders"
    Then 系統回傳 "orders" 資料表的完整結構，包含：
      | 項目                          |
      | columns（name, type, nullable, default） |
      | primary key                   |
      | indexes（含 unique）          |
      | foreign keys（可選）          |
      | row estimate（可選）          |

  Scenario: describe_tables 支援多次呼叫不同資料表
    Given AI Client 指定連線 "sales-db"
    When AI Client 依序呼叫 describe_tables Tool 查詢 "orders" 與 "customers" 資料表
    Then 系統分別回傳各資料表的完整結構
    And 每次呼叫成本低，為單表 metadata 查詢

  Scenario: describe_tables 查詢不存在的資料表
    Given AI Client 指定連線 "sales-db"
    When AI Client 呼叫 describe_tables Tool 並傳入 table_name "nonexistent_table"
    Then 系統回傳資料表不存在的錯誤訊息

  # === discover_schema：全庫或子集、摘要 + 可快取 ===

  Scenario: discover_schema 成功回傳資料庫結構摘要
    Given AI Client 指定連線 "sales-db"
    When AI Client 呼叫 discover_schema Tool 並傳入 connection_name "sales-db"
    Then 系統回傳資料庫結構摘要，包含：
      | 項目                                          |
      | tables list（table_name）                     |
      | 每表欄位摘要（只列 name + type 或只列前 N 欄）|
      | 可能的關聯（FK 或命名推測）                    |

  Scenario: discover_schema 使用 include_patterns 篩選
    Given AI Client 指定連線 "sales-db"
    When AI Client 呼叫 discover_schema Tool 並傳入 include_patterns "order*"
    Then 系統僅回傳符合 "order*" 模式的資料表結構摘要
    And 不回傳不符合模式的資料表

  Scenario: discover_schema 使用 exclude_patterns 排除
    Given AI Client 指定連線 "sales-db"
    When AI Client 呼叫 discover_schema Tool 並傳入 exclude_patterns "tmp_*,log_*"
    Then 系統排除符合 "tmp_*" 與 "log_*" 模式的資料表
    And 回傳其餘資料表的結構摘要

  Scenario: discover_schema 使用 depth 參數控制探索深度
    Given AI Client 指定連線 "sales-db"
    When AI Client 呼叫 discover_schema Tool 並傳入 depth 參數
    Then 系統依據 depth 參數控制回傳的結構深度層級

  Scenario: discover_schema 結果從快取命中
    Given AI Client 已在 5 分鐘前呼叫過 discover_schema 查詢連線 "sales-db"
    And 快取 TTL 設定為 10 分鐘
    When AI Client 再次呼叫 discover_schema Tool 查詢連線 "sales-db" 且相同參數
    Then 系統從快取中回傳結果
    And 不再次查詢資料庫 metadata

  Scenario: discover_schema 快取過期後重新查詢
    Given AI Client 已在 15 分鐘前呼叫過 discover_schema 查詢連線 "sales-db"
    And 快取 TTL 設定為 10 分鐘
    When AI Client 再次呼叫 discover_schema Tool 查詢連線 "sales-db"
    Then 系統重新查詢資料庫 metadata
    And 更新快取內容

  Scenario: discover_schema 輸出大小超過限制時截斷
    Given AI Client 指定連線 "sales-db"
    And 資料庫包含大量資料表
    When AI Client 呼叫 discover_schema Tool 且未傳入篩選條件
    Then 系統回傳結果不超過最大輸出大小限制
    And 系統標示結果已被截斷，提示使用 include_patterns 縮小範圍
