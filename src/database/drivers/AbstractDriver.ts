import type { ConnectionConfig, DatabaseType } from "../../types/connection.ts";
import type { QueryOptions } from "../../types/query.ts";
import type { SchemaOverview, TableDescription } from "../../types/schema.ts";
import type { IDriverAdapter, QueryResult } from "./IDriverAdapter.ts";

const DEFAULT_TABLES: Record<string, TableDescription> = {
  orders: {
    tableName: "orders",
    columns: [
      { name: "id", type: "int", nullable: false },
      { name: "customer_id", type: "int", nullable: false },
      { name: "status", type: "varchar", nullable: false }
    ],
    primaryKey: ["id"],
    indexes: [{ name: "ix_orders_customer_id", columns: ["customer_id"], unique: false }],
    foreignKeys: [
      {
        column: "customer_id",
        referencedTable: "customers",
        referencedColumn: "id"
      }
    ],
    rowEstimate: 1000
  },
  customers: {
    tableName: "customers",
    columns: [
      { name: "id", type: "int", nullable: false },
      { name: "name", type: "varchar", nullable: false }
    ],
    primaryKey: ["id"],
    indexes: [],
    rowEstimate: 200
  }
};

function makeQueryResult(query: string): QueryResult {
  const lowered = query.toLowerCase();
  const rows =
    lowered.includes("orders")
      ? [
          { id: 1, customer_id: 10, status: "active" },
          { id: 2, customer_id: 11, status: "active" }
        ]
      : lowered.includes("customers")
        ? [{ id: 10, name: "Ada" }]
        : [];

  const columns = rows.length
    ? Object.keys(rows[0]).map((name) => ({ name, type: typeof rows[0][name] }))
    : [];

  return {
    columns,
    rows,
    rowCount: rows.length,
    truncated: false,
    executionTimeMs: 1
  };
}

export abstract class AbstractDriver implements IDriverAdapter {
  protected connected = false;
  protected config?: ConnectionConfig;
  private readonly type: DatabaseType;

  constructor(type: DatabaseType) {
    this.type = type;
  }

  async connect(config: ConnectionConfig): Promise<void> {
    this.config = config;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getType(): DatabaseType {
    return this.type;
  }

  async execute(query: string, _options?: QueryOptions): Promise<QueryResult> {
    return makeQueryResult(query);
  }

  async describeTable(tableName: string): Promise<TableDescription> {
    const table = DEFAULT_TABLES[tableName];
    if (!table) {
      throw new Error(`Table '${tableName}' not found`);
    }
    return table;
  }

  async discoverSchema(options?: {
    includePatterns?: string;
    excludePatterns?: string;
    depth?: number;
  }): Promise<SchemaOverview> {
    const depth = options?.depth ?? 2;
    let tables = Object.values(DEFAULT_TABLES).map((table) => ({
      name: table.tableName,
      columns: depth <= 1 ? [] : table.columns.map((column) => ({ name: column.name, type: column.type }))
    }));

    if (options?.includePatterns) {
      const pattern = new RegExp(`^${options.includePatterns.replace(/\*/g, ".*")}$`);
      tables = tables.filter((table) => pattern.test(table.name));
    }

    if (options?.excludePatterns) {
      const patterns = options.excludePatterns
        .split(",")
        .map((item) => new RegExp(`^${item.trim().replace(/\*/g, ".*")}$`));
      tables = tables.filter((table) => patterns.every((pattern) => !pattern.test(table.name)));
    }

    return {
      database: this.config?.database ?? "unknown",
      tables,
      relationships: [
        {
          sourceTable: "orders",
          sourceColumn: "customer_id",
          targetTable: "customers",
          targetColumn: "id"
        }
      ],
      truncated: false
    };
  }

  async executeMongo(
    collection: string,
    operation: string,
    payload: {
      filter?: Record<string, unknown>;
      pipeline?: Record<string, unknown>[];
    },
    _options?: QueryOptions
  ): Promise<QueryResult> {
    const rows =
      operation === "listCollections"
        ? [{ name: "orders" }, { name: "customers" }]
        : operation === "countDocuments"
          ? [{ count: 2 }]
          : [
              {
                collection,
                operation,
                ...payload.filter
              }
            ];

    return {
      columns: rows.length ? Object.keys(rows[0]).map((name) => ({ name, type: typeof rows[0][name] })) : [],
      rows,
      rowCount: rows.length,
      truncated: false,
      executionTimeMs: 1
    };
  }
}
