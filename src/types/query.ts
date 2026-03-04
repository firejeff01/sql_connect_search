export interface QueryDatabaseInput {
  connection_name?: string;
  query: string;
  limit?: number;
  timeout_ms?: number;
}

export type MongoOperation =
  | "find"
  | "aggregate"
  | "countDocuments"
  | "distinct"
  | "listCollections"
  | "listIndexes"
  | "explain";

export interface MongoDBQueryInput {
  connection_name?: string;
  collection: string;
  operation?: MongoOperation;
  filter?: Record<string, unknown>;
  pipeline?: Record<string, unknown>[];
  limit?: number;
  timeout_ms?: number;
}

export interface QueryOptions {
  limit?: number;
  timeoutMs?: number;
  maxExecutionTimeMs?: number;
}
