import { performance } from "node:perf_hooks";
import mysql, { type FieldPacket, type Pool, type RowDataPacket } from "mysql2/promise";
import type { ConnectionConfig } from "../../types/connection.ts";
import type { QueryOptions } from "../../types/query.ts";
import type { SchemaOverview, TableDescription } from "../../types/schema.ts";
import { AbstractDriver } from "./AbstractDriver.ts";
import type { QueryResult } from "./IDriverAdapter.ts";

interface IndexRow extends RowDataPacket {
  Key_name: string;
  Column_name: string;
  Non_unique: number;
}

interface ForeignKeyRow extends RowDataPacket {
  COLUMN_NAME: string;
  REFERENCED_TABLE_NAME: string | null;
  REFERENCED_COLUMN_NAME: string | null;
}

interface ColumnRow extends RowDataPacket {
  Field: string;
  Type: string;
  Null: "YES" | "NO";
  Default: unknown;
  Key: string;
}

interface TableStatsRow extends RowDataPacket {
  TABLE_NAME: string;
  TABLE_ROWS: number | null;
}

export class MySQLDriver extends AbstractDriver {
  private pool?: Pool;

  constructor() {
    super("mysql2");
  }

  override async connect(config: ConnectionConfig): Promise<void> {
    await super.connect(config);
    if (!config.password) {
      return;
    }
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  override async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = undefined;
    }
    await super.disconnect();
  }

  private getPool(): Pool {
    if (!this.pool || !this.config) {
      throw new Error("MySQL driver is not connected");
    }
    return this.pool;
  }

  override async execute(query: string, options?: QueryOptions): Promise<QueryResult> {
    if (!this.pool) {
      return super.execute(query, options);
    }
    const started = performance.now();
    const [rows, fields] = await this.getPool().query({
      sql: query,
      timeout: options?.timeoutMs
    });
    const dataRows = Array.isArray(rows) ? rows : [];
    return {
      columns: (fields ?? []).map((field: FieldPacket) => ({
        name: field.name,
        type: String(field.type)
      })),
      rows: dataRows as Record<string, unknown>[],
      rowCount: dataRows.length,
      truncated: false,
      executionTimeMs: Math.round(performance.now() - started)
    };
  }

  override async describeTable(tableName: string): Promise<TableDescription> {
    if (!this.pool) {
      return super.describeTable(tableName);
    }
    const pool = this.getPool();
    const [columns] = await pool.query<ColumnRow[]>(`DESCRIBE \`${tableName}\``);
    if (!columns.length) {
      throw new Error(`Table '${tableName}' not found`);
    }

    const [indexes] = await pool.query<IndexRow[]>(`SHOW INDEX FROM \`${tableName}\``);
    const [foreignKeys] = await pool.query<ForeignKeyRow[]>(
      `
        SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `,
      [this.config!.database, tableName]
    );
    const [statsRows] = await pool.query<TableStatsRow[]>(
      `
        SELECT TABLE_NAME, TABLE_ROWS
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
      `,
      [this.config!.database, tableName]
    );

    const groupedIndexes = new Map<string, { name: string; columns: string[]; unique: boolean }>();
    for (const index of indexes) {
      if (!groupedIndexes.has(index.Key_name)) {
        groupedIndexes.set(index.Key_name, {
          name: index.Key_name,
          columns: [],
          unique: index.Non_unique === 0
        });
      }
      groupedIndexes.get(index.Key_name)!.columns.push(index.Column_name);
    }

    return {
      tableName,
      columns: columns.map((column) => ({
        name: column.Field,
        type: column.Type,
        nullable: column.Null === "YES",
        defaultValue: column.Default
      })),
      primaryKey: columns.filter((column) => column.Key === "PRI").map((column) => column.Field),
      indexes: [...groupedIndexes.values()],
      foreignKeys: foreignKeys.map((row) => ({
        column: row.COLUMN_NAME,
        referencedTable: row.REFERENCED_TABLE_NAME ?? "",
        referencedColumn: row.REFERENCED_COLUMN_NAME ?? ""
      })),
      rowEstimate: statsRows[0]?.TABLE_ROWS ?? undefined
    };
  }

  override async discoverSchema(options?: {
    includePatterns?: string;
    excludePatterns?: string;
    depth?: number;
  }): Promise<SchemaOverview> {
    if (!this.pool) {
      return super.discoverSchema(options);
    }
    const pool = this.getPool();
    const [tableRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME
      `,
      [this.config!.database]
    );

    const includePatterns = options?.includePatterns
      ? options.includePatterns.split(",").map((item) => new RegExp(`^${item.trim().replace(/\*/g, ".*")}$`))
      : [];
    const excludePatterns = options?.excludePatterns
      ? options.excludePatterns.split(",").map((item) => new RegExp(`^${item.trim().replace(/\*/g, ".*")}$`))
      : [];

    const filteredNames = tableRows
      .map((row) => String(row.TABLE_NAME))
      .filter((name) => includePatterns.length === 0 || includePatterns.some((pattern) => pattern.test(name)))
      .filter((name) => excludePatterns.length === 0 || excludePatterns.every((pattern) => !pattern.test(name)));

    const depth = options?.depth ?? 2;
    const tables = [];
    for (const tableName of filteredNames) {
      if (depth <= 1) {
        tables.push({ name: tableName, columns: [] });
        continue;
      }
      const [columnRows] = await pool.query<RowDataPacket[]>(
        `
          SELECT COLUMN_NAME, COLUMN_TYPE
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `,
        [this.config!.database, tableName]
      );
      tables.push({
        name: tableName,
        columns: columnRows.map((row) => ({
          name: String(row.COLUMN_NAME),
          type: String(row.COLUMN_TYPE)
        }))
      });
    }

    const [relationshipRows] = await pool.query<ForeignKeyRow[]>(
      `
        SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ?
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `,
      [this.config!.database]
    );

    return {
      database: this.config!.database,
      tables,
      relationships: relationshipRows.map((row: RowDataPacket) => ({
        sourceTable: String(row.TABLE_NAME),
        sourceColumn: String(row.COLUMN_NAME),
        targetTable: String(row.REFERENCED_TABLE_NAME),
        targetColumn: String(row.REFERENCED_COLUMN_NAME)
      })),
      truncated: false
    };
  }
}
