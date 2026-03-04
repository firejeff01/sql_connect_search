# language: zh-TW
Feature: Credential 加密管理（Credential Management）
  作為 系統管理者
  我希望 資料庫連線密碼能安全存放與解析
  以便 避免密碼明文暴露，符合安全規範

  # === Layer A：環境變數 / .env（預設） ===

  Scenario: 使用環境變數引用解析密碼（預設方式）
    Given YAML 設定檔中 password 欄位使用引用語法 "${MSSQL_PASSWORD}"
    And 環境變數 MSSQL_PASSWORD 已設定有效值
    When 系統載入設定檔並解析 credential
    Then 系統從環境變數 MSSQL_PASSWORD 取得密碼
    And 系統成功建立資料庫連線

  Scenario: 環境變數未設定時解析失敗
    Given YAML 設定檔中 password 欄位使用引用語法 "${MSSQL_PASSWORD}"
    And 環境變數 MSSQL_PASSWORD 未設定
    When 系統載入設定檔並解析 credential
    Then 系統回傳 credential 解析失敗錯誤
    And 系統提示環境變數 MSSQL_PASSWORD 未設定

  Scenario: 使用 .env 檔案載入環境變數
    Given 專案目錄下存在 .env 檔案，包含 MSSQL_PASSWORD 設定
    And YAML 設定檔中 password 欄位使用引用語法 "${MSSQL_PASSWORD}"
    When 系統載入設定檔並解析 credential
    Then 系統從 .env 檔案載入環境變數
    And 系統成功從環境變數取得密碼

  # === Layer B：本機加密（可選） ===

  Scenario: 使用 OS keychain 解析密碼
    Given 系統設定 credential provider 為 OS keychain
    And keychain 中已儲存連線 "sales-db" 的密碼
    When 系統載入設定檔並解析連線 "sales-db" 的 credential
    Then 系統從 OS keychain 取得密碼
    And 系統成功建立資料庫連線

  Scenario: OS keychain 中找不到密碼時解析失敗
    Given 系統設定 credential provider 為 OS keychain
    And keychain 中未儲存連線 "sales-db" 的密碼
    When 系統載入設定檔並解析連線 "sales-db" 的 credential
    Then 系統回傳 credential 解析失敗錯誤
    And 系統提示 keychain 中找不到對應的密碼

  # === Layer C：外部 Vault（企業選配） ===

  Scenario: 使用 HashiCorp Vault 解析密碼
    Given 系統設定 credential provider 為 HashiCorp Vault
    And Vault 中已儲存連線 "sales-db" 的密碼
    When 系統載入設定檔並解析連線 "sales-db" 的 credential
    Then 系統透過 Vault API 取得密碼
    And 系統成功建立資料庫連線

  Scenario: 使用 AWS Secrets Manager 解析密碼
    Given 系統設定 credential provider 為 AWS Secrets Manager
    And Secrets Manager 中已儲存連線 "sales-db" 的密碼
    When 系統載入設定檔並解析連線 "sales-db" 的 credential
    Then 系統透過 AWS Secrets Manager API 取得密碼
    And 系統成功建立資料庫連線

  Scenario: 使用 Azure Key Vault 解析密碼
    Given 系統設定 credential provider 為 Azure Key Vault
    And Key Vault 中已儲存連線 "sales-db" 的密碼
    When 系統載入設定檔並解析連線 "sales-db" 的 credential
    Then 系統透過 Azure Key Vault API 取得密碼
    And 系統成功建立資料庫連線

  Scenario: 外部 Vault 無法連線時解析失敗
    Given 系統設定 credential provider 為 HashiCorp Vault
    And Vault 服務無法連線
    When 系統載入設定檔並解析連線 "sales-db" 的 credential
    Then 系統回傳 credential 解析失敗錯誤
    And 系統提示 Vault 服務無法連線

  # === Secret Provider Plugin Interface ===

  Scenario: 透過可插拔 Secret Provider 介面擴充
    Given 系統已註冊自訂的 Secret Provider plugin
    When 系統載入設定檔並解析 credential
    Then 系統透過自訂 plugin 的介面取得密碼

  # === AES 檔案加密（不建議作為第一選項） ===

  Scenario: 使用 AES 加密檔案解析密碼
    Given 系統設定 credential provider 為 AES 檔案加密
    And master key 存放在環境變數中
    And 加密檔案中已儲存連線 "sales-db" 的密碼
    When 系統載入設定檔並解析連線 "sales-db" 的 credential
    Then 系統使用 master key 解密檔案並取得密碼
    And 系統成功建立資料庫連線

  Scenario: AES 加密的 master key 未設定時解析失敗
    Given 系統設定 credential provider 為 AES 檔案加密
    And master key 環境變數未設定
    When 系統載入設定檔並解析 credential
    Then 系統回傳 credential 解析失敗錯誤
    And 系統提示 master key 未設定

  # === 安全規範 ===

  Scenario: YAML 設定檔禁止明文存放密碼
    Given YAML 設定檔中 password 欄位直接寫入明文密碼 "plaintext123"
    When 系統載入設定檔
    Then 系統回傳安全警告，提示不應在設定檔中使用明文密碼
    And 系統建議使用環境變數引用語法 "${...}" 或其他加密方式
