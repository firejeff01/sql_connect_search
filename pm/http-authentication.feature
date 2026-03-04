# language: zh-TW
Feature: HTTP 模式認證機制（HTTP Authentication）
  作為 系統管理者
  我希望 HTTP Server 模式具備認證與存取控制機制
  以便 防止未授權的存取，保護資料庫查詢安全

  Background:
    Given MCP Server 以 HTTP 模式啟動
    And 系統已設定至少一組 API Key

  # === API Key 認證（預設支援） ===

  Scenario: API Key 認證成功
    When 客戶端發送 HTTP 請求，header 包含 "Authorization: Bearer valid-api-key"
    Then 系統驗證 API Key 通過
    And 系統繼續處理該請求

  Scenario: API Key 認證失敗 - 缺少 Authorization header
    When 客戶端發送 HTTP 請求但未包含 Authorization header
    Then 系統拒絕請求並回傳 401 Unauthorized 錯誤

  Scenario: API Key 認證失敗 - 無效的 API Key
    When 客戶端發送 HTTP 請求，header 包含 "Authorization: Bearer invalid-api-key"
    Then 系統驗證 API Key 失敗
    And 系統拒絕請求並回傳 401 Unauthorized 錯誤

  Scenario: API Key 認證失敗 - 格式錯誤的 Authorization header
    When 客戶端發送 HTTP 請求，header 包含非 Bearer 格式的 Authorization
    Then 系統拒絕請求並回傳 401 Unauthorized 錯誤

  # === Rate Limit ===

  Scenario: 單一 API Key 請求超過 rate limit
    Given 系統設定 per-key rate limit
    When 同一 API Key 在限制時間內發送超過允許次數的請求
    Then 系統拒絕超額的請求並回傳 429 Too Many Requests 錯誤

  Scenario: 單一 IP 請求超過 rate limit
    Given 系統設定 per-IP rate limit
    When 同一 IP 在限制時間內發送超過允許次數的請求
    Then 系統拒絕超額的請求並回傳 429 Too Many Requests 錯誤

  Scenario: rate limit 時間窗口重置後恢復存取
    Given 同一 API Key 已達到 rate limit 上限
    When rate limit 時間窗口重置
    Then 該 API Key 可再次正常發送請求

  # === CORS ===

  Scenario: 啟用 CORS 設定供瀏覽器使用
    Given 系統啟用了 CORS 設定
    When 瀏覽器發送 preflight OPTIONS 請求
    Then 系統回傳正確的 CORS headers（Access-Control-Allow-Origin、Access-Control-Allow-Methods、Access-Control-Allow-Headers）

  Scenario: 未啟用 CORS 時拒絕跨域請求
    Given 系統未啟用 CORS 設定
    When 瀏覽器發送跨域請求
    Then 系統不回傳 CORS headers

  # === 進階認證方案 ===

  Scenario: 支援 JWT / OIDC 認證（企業選項）
    Given 系統設定認證方案為 JWT / OIDC
    When 客戶端發送 HTTP 請求，header 包含有效的 JWT token
    Then 系統驗證 JWT token 的簽章與有效期限
    And 系統驗證通過後繼續處理該請求

  Scenario: JWT token 過期被拒絕
    Given 系統設定認證方案為 JWT / OIDC
    When 客戶端發送 HTTP 請求，header 包含已過期的 JWT token
    Then 系統拒絕請求並回傳 401 Unauthorized 錯誤

  Scenario: 支援 mTLS 認證（內網高安全場景）
    Given 系統設定認證方案為 mTLS
    When 客戶端使用有效的客戶端憑證建立 TLS 連線
    Then 系統驗證客戶端憑證通過
    And 系統繼續處理該請求

  Scenario: mTLS 認證失敗 - 無效的客戶端憑證
    Given 系統設定認證方案為 mTLS
    When 客戶端使用無效的客戶端憑證建立 TLS 連線
    Then 系統拒絕連線
