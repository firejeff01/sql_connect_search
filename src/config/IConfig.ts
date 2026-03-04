import type { ConnectionConfig, PoolConfig } from "../types/connection.ts";

export interface LimitsConfig {
  max_rows: number;
  timeout: number;
  result_size: number;
  max_execution_time: number;
}

export interface AuditConfig {
  enabled: boolean;
}

export interface RateLimitRule {
  max: number;
  window_ms: number;
}

export interface RateLimitConfig {
  per_key?: RateLimitRule;
  per_ip?: RateLimitRule;
}

export interface CorsConfig {
  enabled: boolean;
  allowed_origins: string[];
  allowed_methods: string[];
  allowed_headers: string[];
}

export interface HttpConfig {
  port: number;
  bind: string;
  api_keys: string[];
  rate_limit?: RateLimitConfig;
  cors?: CorsConfig;
  auth_scheme?: "api_key" | "jwt" | "mtls";
}

export interface CredentialConfig {
  provider?: string;
  vault_url?: string;
  vault_token?: string;
  vault_type?: string;
  aes_key_env?: string;
  aes_file_path?: string;
}

export interface ServerConfig {
  connections: ConnectionConfig[];
  pool: PoolConfig;
  limits: LimitsConfig;
  audit: AuditConfig;
  http?: HttpConfig;
  credential?: CredentialConfig;
  default_connection?: string;
}
