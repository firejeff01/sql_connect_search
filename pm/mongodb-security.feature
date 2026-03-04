# language: zh-TW
Feature: MongoDB 安全攔截（MongoDB Security）
  作為 系統管理者
  我希望 系統能自動攔截 MongoDB 的危險操作
  以便 確保 AI 只能執行唯讀查詢，保護 MongoDB 資料庫安全

  Background:
    Given MCP Server 已啟動且 MongoValidator 已初始化
    And 資料庫連線 "mongo-db" 已建立，類型為 mongodb

  Scenario Outline: 允許的 MongoDB 唯讀操作通過驗證
    When AI Client 對 MongoDB 提交 "<操作類型>" 操作
    Then MongoValidator 驗證通過
    And 系統繼續執行該操作

    Examples:
      | 操作類型         |
      | find             |
      | aggregate        |
      | countDocuments   |
      | distinct         |
      | listCollections  |
      | listIndexes      |
      | explain          |

  Scenario Outline: 禁止的 MongoDB 寫入操作被攔截
    When AI Client 對 MongoDB 提交 "<操作類型>" 操作
    Then MongoValidator 驗證失敗
    And 系統拒絕執行該操作並回傳安全錯誤訊息

    Examples:
      | 操作類型              |
      | insertOne             |
      | insertMany            |
      | updateOne             |
      | updateMany            |
      | replaceOne            |
      | deleteOne             |
      | deleteMany            |
      | bulkWrite             |
      | findOneAndUpdate      |
      | findOneAndDelete      |
      | findOneAndReplace     |

  Scenario Outline: 禁止的 MongoDB 破壞性管理操作被攔截
    When AI Client 對 MongoDB 提交 "<操作類型>" 操作
    Then MongoValidator 驗證失敗
    And 系統拒絕執行該操作並回傳安全錯誤訊息

    Examples:
      | 操作類型           |
      | drop               |
      | dropDatabase       |
      | createCollection   |
      | createIndex        |
      | dropIndex          |
      | renameCollection   |

  Scenario Outline: Aggregate pipeline 包含禁止的 stage 被攔截
    When AI Client 提交 aggregate 操作，pipeline 中包含 "<stage>" stage
    Then MongoValidator 檢測到禁止的 pipeline stage
    And 系統拒絕執行該 aggregate 並回傳安全錯誤訊息，指出 "<stage>" 會寫入資料

    Examples:
      | stage   |
      | $out    |
      | $merge  |

  Scenario: Aggregate pipeline 不包含禁止 stage 時通過驗證
    When AI Client 提交 aggregate 操作，pipeline 中僅包含 $match、$group、$sort、$project 等唯讀 stage
    Then MongoValidator 驗證通過
    And 系統繼續執行該 aggregate 操作

  Scenario: 可選限制 $lookup 防止跨庫爆量查詢
    Given 系統啟用了 $lookup 限制設定
    When AI Client 提交 aggregate 操作，pipeline 中包含 "$lookup" stage
    Then 系統根據設定決定是否允許或攔截該操作

  Scenario: 可選限制 $graphLookup 防止跨庫爆量查詢
    Given 系統啟用了 $graphLookup 限制設定
    When AI Client 提交 aggregate 操作，pipeline 中包含 "$graphLookup" stage
    Then 系統根據設定決定是否允許或攔截該操作

  Scenario: MongoDB 查詢自動套用預設 limit 1000 筆
    When AI Client 提交 find 操作但未指定 limit
    Then 系統自動注入 limit 1000 筆
    And 查詢結果最多回傳 1000 筆文件

  Scenario: MongoDB 查詢自動套用預設 maxTimeMS 30000
    When AI Client 提交 find 操作但未指定 maxTimeMS
    Then 系統自動注入 maxTimeMS 30000 毫秒
    And 查詢超過 30 秒後自動中止並回傳逾時錯誤

  Scenario: 雙保險機制 - server policy 攔截寫入操作
    When AI Client 對 MongoDB 提交 "insertOne" 操作
    Then server policy 層在發送到資料庫之前攔截該操作
    And 系統拒絕執行並回傳安全錯誤訊息

  Scenario: 雙保險機制 - DB RBAC 只讀帳號阻擋漏網寫入
    Given MongoDB 連線使用 RBAC 只讀帳號
    When 有操作繞過 server policy 嘗試寫入
    Then MongoDB 資料庫層面拒絕寫入操作
    And 系統回傳權限不足錯誤
