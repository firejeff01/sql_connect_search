# language: zh-TW
Feature: 多資料庫 Driver 支援（Multi-Database Driver）
  作為 AI Client
  我希望 系統能支援多種資料庫類型
  以便 透過統一介面查詢不同的資料庫

  Background:
    Given MCP Server 已啟動且 Tools 已註冊

  Scenario Outline: 支援不同類型的資料庫連線
    Given 設定檔中包含類型為 "<資料庫類型>" 的連線，使用 driver "<Driver>"
    When 系統建立該資料庫的連線
    Then 系統透過對應的 Driver Adapter 成功建立連線
    And 查詢結果以統一格式回傳，包含 columns 與 rows

    Examples:
      | 資料庫類型             | Driver   |
      | Microsoft SQL Server   | mssql    |
      | MySQL                  | mysql2   |
      | PostgreSQL             | pg       |
      | Oracle                 | oracledb |
      | MongoDB                | mongodb  |

  Scenario: 查詢結果統一輸出格式
    Given AI Client 對任一資料庫執行查詢
    When 查詢成功執行
    Then 系統回傳統一格式的結果，包含 columns 陣列與 rows 陣列
