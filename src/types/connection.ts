export type DatabaseType = "mssql" | "mysql2" | "pg" | "oracledb" | "mongodb";

export interface ConnectionConfig {
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  passwordRef?: string;
  aliases?: string[];
}

export interface PoolConfig {
  max: number;
  min: number;
  idleTimeout: number;
}

export interface ConnectionCapabilities {
  supportedTools: string[];
  readOnly: boolean;
  maxRows: number;
  allowedSchemas: string[];
}

export interface ConnectionInfo {
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  aliases?: string[];
}
