import type { ConnectionConfig, DatabaseType } from "../../types/connection.ts";
import type { QueryOptions } from "../../types/query.ts";
import type { SchemaOverview, TableDescription } from "../../types/schema.ts";

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface QueryResult {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  executionTimeMs: number;
}

export interface IDriverAdapter {
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  execute(query: string, options?: QueryOptions): Promise<QueryResult>;
  isConnected(): boolean;
  getType(): DatabaseType;
  describeTable?(tableName: string): Promise<TableDescription>;
  discoverSchema?(options?: {
    includePatterns?: string;
    excludePatterns?: string;
    depth?: number;
  }): Promise<SchemaOverview>;
  executeMongo?(
    collection: string,
    operation: string,
    payload: {
      filter?: Record<string, unknown>;
      pipeline?: Record<string, unknown>[];
    },
    options?: QueryOptions
  ): Promise<QueryResult>;
}
