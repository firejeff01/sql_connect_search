# 事件風暴分析：MCP Database Server 專業版

## Bounded Context 1：連線管理（Connection Management）

### Domain Events（領域事件）
- 🟠 連線清單已列出（ConnectionsListed）：系統回傳所有已設定的資料庫連線清單
- 🟠 連線池已建立（ConnectionPoolCreated）：系統為指定資料庫建立連線池
- 🟠 連線池已銷毀（ConnectionPoolDestroyed）：系統銷毀閒置超時的連線池
- 🟠 設定檔已載入（ConfigLoaded）：系統成功讀取 YAML 設定檔中的連線資訊
- 🟠 連線能力已回報（ConnectionCapabilitiesReported）：系統回傳指定連線支援的 tool 清單、read-only 狀態、最大 rows、允許的 schema

### Commands（命令）
- 🔵 列出資料庫連線（ListConnections）：列出所有已設定的資料庫連線，由 AI Client 觸發
- 🔵 建立連線池（CreateConnectionPool）：為指定資料庫建立連線池，由系統啟動時觸發
- 🔵 載入設定檔（LoadConfig）：讀取 YAML 設定檔，由系統啟動時觸發
- 🔵 查詢連線能力（QueryConnectionCapabilities）：回報指定連線的 capabilities，由 AI Client 觸發

### Aggregates（聚合）
- 🟡 ConnectionManager：管理所有資料庫連線與連線池的生命週期
  - 接收命令：ListConnections、CreateConnectionPool、LoadConfig、QueryConnectionCapabilities
  - 產生事件：ConnectionsListed、ConnectionPoolCreated、ConnectionPoolDestroyed、ConfigLoaded、ConnectionCapabilitiesReported

### Policies（政策/規則）
- 🔴 當 ConfigLoaded 發生時 → 執行 CreateConnectionPool（為每個設定的資料庫建立連線池）
- 🔴 當連線閒置超過 idleTimeout 時 → 執行銷毀連線池（ConnectionPoolDestroyed）
- 🔴 所有查詢工具必須傳入 connection_name（必填參數），connection_name 支援 alias
- 🔴 每個查詢工具接受可選的 limit 與 timeout_ms 參數，但受 server 上限夾制
- 🔴 default_connection 僅建議在 dev 環境使用

---

## Bounded Context 2：SQL 查詢（Query Execution）

### Domain Events（領域事件）
- 🟠 SQL 查詢已執行（QueryExecuted）：SQL 查詢成功執行並回傳結果（columns + rows）
- 🟠 SQL 查詢已拒絕（QueryRejected）：SQL 查詢因安全驗證不通過而被拒絕
- 🟠 查詢已逾時（QueryTimedOut）：SQL 查詢超過設定的 timeout 限制
- 🟠 查詢結果已截斷（QueryResultTruncated）：查詢結果超過 max_rows 或 result size 限制，被截斷回傳
- 🟠 MongoDB 查詢已執行（MongoQueryExecuted）：MongoDB 查詢成功執行並回傳結果
- 🟠 MongoDB 查詢已拒絕（MongoQueryRejected）：MongoDB 查詢因安全攔截不通過而被拒絕

### Commands（命令）
- 🔵 執行 SQL 查詢（QueryDatabase）：對指定資料庫執行 SQL 查詢，由 AI Client 觸發。必填參數：connection_name、query；可選參數：limit、timeout_ms
- 🔵 執行 MongoDB 查詢（MongoDBQuery）：對 MongoDB 執行查詢，由 AI Client 觸發。必填參數：connection_name、collection、filter；可選參數：limit、timeout_ms

### Aggregates（聚合）
- 🟡 QueryExecutor：負責接收查詢命令、協調安全驗證與限制控制，最終執行查詢
  - 接收命令：QueryDatabase、MongoDBQuery
  - 產生事件：QueryExecuted、QueryRejected、QueryTimedOut、QueryResultTruncated、MongoQueryExecuted、MongoQueryRejected

### Policies（政策/規則）
- 🔴 當 QueryDatabase 命令收到時 → 先執行 SQL 安全驗證（SQL Validator），驗證不通過則產生 QueryRejected
- 🔴 當 MongoDBQuery 命令收到時 → 先執行 MongoDB 安全攔截（MongoValidator），驗證不通過則產生 MongoQueryRejected
- 🔴 當查詢執行時間超過 timeout（預設 30s）時 → 產生 QueryTimedOut
- 🔴 當查詢結果超過 max_rows（預設 1000）或 result size（預設 5MB）時 → 產生 QueryResultTruncated
- 🔴 當 QueryExecuted 或 MongoQueryExecuted 發生時 → 執行寫入稽核日誌（WriteAuditLog）
- 🔴 MongoDB 查詢預設 limit: 1000 筆、預設 maxTimeMS: 30000 (30 秒)
- 🔴 使用者傳入的 limit 與 timeout_ms 不得超過 server 設定的上限值

---

## Bounded Context 3：SQL 安全驗證（SQL Security）

### Domain Events（領域事件）
- 🟠 SQL 驗證通過（SQLValidationPassed）：SQL 語句通過安全解析，為允許的語句類型（SELECT / SHOW / DESCRIBE / EXPLAIN）
- 🟠 SQL 驗證失敗（SQLValidationFailed）：SQL 語句包含禁止的語句類型（INSERT / UPDATE / DELETE / DROP / ALTER / TRUNCATE）

### Commands（命令）
- 🔵 驗證 SQL 語句（ValidateSQL）：解析 SQL 語句並檢測語句類型，由 QueryExecutor 內部觸發

### Aggregates（聚合）
- 🟡 SQLValidator：負責 SQL 語句的安全解析與類型檢測
  - 接收命令：ValidateSQL
  - 產生事件：SQLValidationPassed、SQLValidationFailed

### Policies（政策/規則）
- 🔴 當 SQL 語句類型為 SELECT / SHOW / DESCRIBE / EXPLAIN 時 → 產生 SQLValidationPassed
- 🔴 當 SQL 語句類型為 INSERT / UPDATE / DELETE / DROP / ALTER / TRUNCATE 時 → 產生 SQLValidationFailed

---

## Bounded Context 4：MongoDB 安全攔截（MongoDB Security）

### Domain Events（領域事件）
- 🟠 MongoDB 操作驗證通過（MongoValidationPassed）：MongoDB 操作為允許的唯讀操作
- 🟠 MongoDB 操作驗證失敗（MongoValidationFailed）：MongoDB 操作為禁止的寫入/破壞性操作
- 🟠 MongoDB Aggregate Pipeline 驗證失敗（MongoAggregatePipelineRejected）：Aggregate pipeline 包含禁止的 stage（$out / $merge）

### Commands（命令）
- 🔵 驗證 MongoDB 操作（ValidateMongoOperation）：檢測 MongoDB 操作類型是否為允許的唯讀操作，由 QueryExecutor 內部觸發
- 🔵 驗證 Aggregate Pipeline（ValidateAggregatePipeline）：檢測 aggregate pipeline 中是否包含禁止的 stage，由 QueryExecutor 內部觸發

### Aggregates（聚合）
- 🟡 MongoValidator：負責 MongoDB 操作的安全攔截與 pipeline 檢測
  - 接收命令：ValidateMongoOperation、ValidateAggregatePipeline
  - 產生事件：MongoValidationPassed、MongoValidationFailed、MongoAggregatePipelineRejected

### Policies（政策/規則）
- 🔴 允許的 MongoDB 操作：find、aggregate（需通過 pipeline 檢查）、countDocuments、distinct、listCollections、listIndexes、explain
- 🔴 禁止的 MongoDB 操作：insertOne/Many、updateOne/Many、replaceOne、deleteOne/Many、bulkWrite、findOneAndUpdate/Delete/Replace、drop、dropDatabase、createCollection、createIndex、dropIndex、renameCollection
- 🔴 Aggregate pipeline 禁止的 stage：$out、$merge（會寫入資料）
- 🔴 可選限制：$lookup / $graphLookup（防止跨庫爆量查詢）
- 🔴 雙保險機制：server policy 攔截 + DB permissions（MongoDB RBAC 只讀帳號）

---

## Bounded Context 5：Schema 探索（Schema Discovery）

### Domain Events（領域事件）
- 🟠 資料表結構已描述（TablesDescribed）：系統回傳單一資料表的完整細節，包含 columns（name, type, nullable, default）、primary key、indexes（含 unique）、foreign keys（可選）、row estimate（可選）
- 🟠 Schema 已探索（SchemaDiscovered）：系統回傳資料庫結構摘要，包含 tables list、每表欄位摘要、可能的關聯
- 🟠 Schema 快取已命中（SchemaCacheHit）：discover_schema 結果從快取中取得
- 🟠 Schema 快取已更新（SchemaCacheUpdated）：discover_schema 結果已寫入快取

### Commands（命令）
- 🔵 描述資料表（DescribeTables）：查詢單一資料表的完整結構細節，由 AI Client 觸發。必填參數：connection_name、table_name
- 🔵 探索 Schema（DiscoverSchema）：探索資料庫結構摘要，由 AI Client 觸發。必填參數：connection_name；可選參數：include_patterns、exclude_patterns、depth

### Aggregates（聚合）
- 🟡 SchemaService：負責查詢並回傳資料庫結構資訊
  - 接收命令：DescribeTables、DiscoverSchema
  - 產生事件：TablesDescribed、SchemaDiscovered、SchemaCacheHit、SchemaCacheUpdated

### Policies（政策/規則）
- 🔴 describe_tables 為單表精準查詢，回傳完整細節（columns、primary key、indexes、foreign keys、row estimate），成本低，支援多次呼叫
- 🔴 discover_schema 為全庫或子集探索，回傳摘要資訊（tables list、每表僅列 name + type 或前 N 欄、粗略關聯）
- 🔴 discover_schema 必須支援 cache（TTL，例如 10 分鐘）
- 🔴 discover_schema 必須支援篩選（include_patterns / exclude_patterns），避免整庫掃爆
- 🔴 discover_schema 有最大輸出大小限制，避免 token 爆炸

---

## Bounded Context 6：稽核日誌（Audit Log）

### Domain Events（領域事件）
- 🟠 稽核日誌已寫入（AuditLogWritten）：系統成功記錄一筆查詢的稽核日誌，包含 timestamp、connection_name、query、row_count、execution_time、client

### Commands（命令）
- 🔵 寫入稽核日誌（WriteAuditLog）：記錄查詢的稽核資訊，由系統內部觸發

### Aggregates（聚合）
- 🟡 AuditLogger：負責記錄所有 AI 查詢的稽核日誌
  - 接收命令：WriteAuditLog
  - 產生事件：AuditLogWritten

### Policies（政策/規則）
- 🔴 當 QueryExecuted 或 MongoQueryExecuted 發生時 → 執行 WriteAuditLog（記錄查詢稽核日誌）
- 🔴 稽核日誌功能受設定檔 `audit.enabled` 控制，僅在啟用時記錄
- 🔴 STDIO MCP 模式下仍需記錄稽核日誌

---

## Bounded Context 7：伺服器啟動與認證（Server Startup & Authentication）

### Domain Events（領域事件）
- 🟠 MCP Server 已啟動（MCPServerStarted）：MCP Server 以 CLI/MCP 模式或 HTTP Server 模式成功啟動
- 🟠 MCP Tools 已註冊（MCPToolsRegistered）：所有 MCP Tools（list_connections、describe_tables、query_database、mongodb_query、discover_schema）已完成註冊
- 🟠 HTTP 認證成功（HTTPAuthSucceeded）：HTTP 模式下 API Key 驗證通過
- 🟠 HTTP 認證失敗（HTTPAuthFailed）：HTTP 模式下 API Key 驗證失敗
- 🟠 請求已被速率限制（RequestRateLimited）：HTTP 模式下請求超過 rate limit（per key / per IP）

### Commands（命令）
- 🔵 啟動 MCP Server（StartMCPServer）：以指定模式啟動 MCP Server，由使用者透過 CLI 觸發
- 🔵 註冊 MCP Tools（RegisterMCPTools）：將所有 Tool 註冊至 MCP SDK，由系統啟動流程觸發
- 🔵 驗證 HTTP 請求（AuthenticateHTTPRequest）：驗證 HTTP 請求的 Authorization header，由 HTTP Server 中介層觸發
- 🔵 檢查速率限制（CheckRateLimit）：檢查請求是否超過 rate limit，由 HTTP Server 中介層觸發

### Aggregates（聚合）
- 🟡 MCPServer：負責伺服器生命週期管理與 Tool 註冊
  - 接收命令：StartMCPServer、RegisterMCPTools
  - 產生事件：MCPServerStarted、MCPToolsRegistered
- 🟡 HTTPAuthenticator：負責 HTTP 模式下的認證與速率限制
  - 接收命令：AuthenticateHTTPRequest、CheckRateLimit
  - 產生事件：HTTPAuthSucceeded、HTTPAuthFailed、RequestRateLimited

### Policies（政策/規則）
- 🔴 當 StartMCPServer 命令執行時 → 依序執行 LoadConfig、RegisterMCPTools、CreateConnectionPool
- 🔴 當所有初始化完成後 → 產生 MCPServerStarted
- 🔴 STDIO MCP 模式不需要 HTTP auth，但仍需執行 query policy、limits、audit
- 🔴 HTTP Server 模式必須啟用認證，最少支援 API Key（Authorization: Bearer <key>）
- 🔴 HTTP Server 模式需要 rate limit（per key / per IP）
- 🔴 HTTP Server 模式需要 CORS 設定（若有 browser usage）
- 🔴 HTTP Server 預設只綁定 127.0.0.1，除非明確指定 --bind 0.0.0.0
- 🔴 認證方案分層：(1) API Key — 預設支援 (2) JWT / OIDC — 企業選項 (3) mTLS — 內網高安全場景

---

## Bounded Context 8：Credential 管理（Credential Management）

### Domain Events（領域事件）
- 🟠 Credential 已解析（CredentialResolved）：系統成功從指定來源解析出資料庫連線密碼
- 🟠 Credential 解析失敗（CredentialResolutionFailed）：系統無法從指定來源取得密碼

### Commands（命令）
- 🔵 解析 Credential（ResolveCredential）：從設定的來源取得資料庫連線密碼，由 ConnectionManager 在建立連線時觸發

### Aggregates（聚合）
- 🟡 CredentialProvider：負責從不同來源解析連線密碼
  - 接收命令：ResolveCredential
  - 產生事件：CredentialResolved、CredentialResolutionFailed

### Policies（政策/規則）
- 🔴 Layer A — 環境變數 / .env（預設）：YAML 設定檔中使用引用語法 `${MSSQL_PASSWORD}`，跨平台、CI/CD 友善
- 🔴 Layer B — 本機加密（可選）：OS keychain / DPAPI / Keytar，適合桌面端、個人開發
- 🔴 Layer C — 外部 Vault（企業選配）：HashiCorp Vault / AWS Secrets Manager / Azure Key Vault，透過可插拔 Secret Provider（plugin interface）支援
- 🔴 AES 檔案加密不建議作為第一選項，若使用則 master key 必須存放在環境變數或 keychain/vault
- 🔴 YAML 設定檔禁止明文存放密碼，必須使用引用語法或加密方式
