# language: zh-TW
Feature: SQL 查詢執行（Query Execution）
  作為 AI Client
  我希望 能對指定資料庫執行 SQL 查詢
  以便 即時存取企業資料進行分析與決策

  Background:
    Given MCP Server 已啟動且 Tools 已註冊
    And 資料庫連線 "sales-db" 已建立連線池

  Scenario: 成功執行 SELECT 查詢
    Given AI Client 指定連線 "sales-db"
    When AI Client 呼叫 query_database Tool 並傳入 connection_name "sales-db" 與 query "SELECT * FROM orders"
    Then 系統通過 SQL 安全驗證
    And 系統成功執行查詢並回傳結果，格式包含 columns 與 rows
    And 系統寫入稽核日誌，記錄 timestamp、connection_name、query、row_count、execution_time、client

  Scenario: 成功執行 SHOW 語句
    Given AI Client 指定連線 "sales-db"
    When AI Client 呼叫 query_database Tool 並傳入 connection_name "sales-db" 與 query "SHOW TABLES"
    Then 系統通過 SQL 安全驗證
    And 系統成功執行查詢並回傳結果

  Scenario: 成功執行 DESCRIBE 語句
    Given AI Client 指定連線 "sales-db"
    When AI Client 呼叫 query_database Tool 並傳入 connection_name "sales-db" 與 query "DESCRIBE orders"
    Then 系統通過 SQL 安全驗證
    And 系統成功執行查詢並回傳結果

  Scenario: 成功執行 EXPLAIN 語句
    Given AI Client 指定連線 "sales-db"
    When AI Client 呼叫 query_database Tool 並傳入 connection_name "sales-db" 與 query "EXPLAIN SELECT * FROM orders"
    Then 系統通過 SQL 安全驗證
    And 系統成功執行查詢並回傳結果

  Scenario: 查詢結果超過 max_rows 限制時截斷回傳
    Given 系統設定 max_rows 為 1000
    And AI Client 指定連線 "sales-db"
    When AI Client 呼叫 query_database Tool 並傳入查詢，結果超過 1000 筆
    Then 系統回傳前 1000 筆結果
    And 系統標示結果已被截斷

  Scenario: 查詢結果超過 result size 限制時截斷回傳
    Given 系統設定 result size 為 5MB
    And AI Client 指定連線 "sales-db"
    When AI Client 呼叫 query_database Tool 並傳入查詢，結果超過 5MB
    Then 系統截斷結果至 5MB 以內
    And 系統標示結果已被截斷

  Scenario: 查詢執行超過 timeout 限制
    Given 系統設定 query timeout 為 30 秒
    And AI Client 指定連線 "sales-db"
    When AI Client 呼叫 query_database Tool 並傳入需要長時間執行的 SQL
    Then 系統在 30 秒後中止查詢
    And 系統回傳查詢逾時錯誤

  Scenario: 查詢執行超過 max execution time 限制
    Given 系統設定 max execution time 為 60 秒
    And AI Client 指定連線 "sales-db"
    When AI Client 呼叫 query_database Tool 並傳入需要超過 60 秒的 SQL
    Then 系統在 60 秒後強制中止查詢
    And 系統回傳執行時間超限錯誤

  Scenario: 成功執行 MongoDB find 查詢
    Given 資料庫連線 "mongo-db" 已建立，類型為 mongodb
    When AI Client 呼叫 mongodb_query Tool 並傳入 connection_name "mongo-db"、collection "orders"、filter 查詢條件
    Then 系統通過 MongoDB 安全攔截驗證
    And 系統成功執行 MongoDB 查詢並回傳結果
    And 系統寫入稽核日誌

  Scenario: MongoDB 查詢套用預設 limit 1000 筆
    Given 資料庫連線 "mongo-db" 已建立，類型為 mongodb
    When AI Client 呼叫 mongodb_query Tool 但未傳入 limit 參數
    Then 系統自動套用預設 limit 1000 筆
    And 查詢結果最多回傳 1000 筆文件

  Scenario: MongoDB 查詢套用預設 maxTimeMS 30000
    Given 資料庫連線 "mongo-db" 已建立，類型為 mongodb
    When AI Client 呼叫 mongodb_query Tool 但未傳入 timeout_ms 參數
    Then 系統自動套用預設 maxTimeMS 30000 毫秒
    And 查詢超過 30 秒後自動中止
