# language: zh-TW
Feature: SQL 安全驗證（SQL Security）
  作為 系統管理者
  我希望 系統能自動攔截危險的 SQL 語句
  以便 確保 AI 只能執行唯讀查詢，保護資料庫安全

  Background:
    Given MCP Server 已啟動且 SQL Validator 已初始化

  Scenario Outline: 允許的 SQL 語句類型通過驗證
    When AI Client 提交的 SQL 語句類型為 "<語句類型>"
    Then SQL Validator 驗證通過
    And 系統繼續執行查詢

    Examples:
      | 語句類型 |
      | SELECT   |
      | SHOW     |
      | DESCRIBE |
      | EXPLAIN  |

  Scenario Outline: 禁止的 SQL 語句類型被攔截
    When AI Client 提交的 SQL 語句類型為 "<語句類型>"
    Then SQL Validator 驗證失敗
    And 系統拒絕執行查詢並回傳安全錯誤訊息

    Examples:
      | 語句類型 |
      | INSERT   |
      | UPDATE   |
      | DELETE   |
      | DROP     |
      | ALTER    |
      | TRUNCATE |

  Scenario: SQL Injection 攻擊被攔截
    When AI Client 提交包含 SQL Injection 的語句
    Then SQL Validator 檢測到注入攻擊
    And 系統拒絕執行查詢並回傳安全錯誤訊息

  Scenario: Read Only 強制執行
    When AI Client 提交任何會修改資料的 SQL 語句
    Then 系統強制執行唯讀模式
    And 系統拒絕執行該語句
