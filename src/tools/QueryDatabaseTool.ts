import type { LimitsConfig } from "../config/IConfig.ts";
import { AuditLogger } from "../audit/AuditLogger.ts";
import { ConnectionManager } from "../database/pool/ConnectionManager.ts";
import type { QueryResult } from "../database/drivers/IDriverAdapter.ts";
import { QueryPolicy } from "../security/QueryPolicy.ts";
import { SQLValidator } from "../security/SQLValidator.ts";
import type { QueryDatabaseInput } from "../types/query.ts";
import type { ToolDefinition } from "./ITool.ts";

export class QueryDatabaseTool implements ToolDefinition<QueryDatabaseInput, QueryResult> {
  readonly name = "query_database";
  readonly description = "Execute a read-only SQL query";
  readonly inputSchema = {
    type: "object",
    properties: {
      connection_name: {
        type: "string",
        description: "Configured connection name or alias. Optional when default_connection is set."
      },
      query: {
        type: "string",
        description: "Read-only SQL query. Only SELECT/SHOW/DESCRIBE/EXPLAIN are allowed."
      },
      limit: {
        type: "integer",
        description: "Optional row limit. Clamped by server policy."
      },
      timeout_ms: {
        type: "integer",
        description: "Optional query timeout in milliseconds. Clamped by server policy."
      }
    },
    required: ["query"],
    additionalProperties: false
  } as const;
  readonly outputSchema = {
    type: "object",
    description: "Tabular query result with row truncation metadata.",
    properties: {
      columns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { type: "string" }
          },
          required: ["name", "type"],
          additionalProperties: false
        }
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          description: "One result row keyed by column name.",
          additionalProperties: true
        }
      },
      rowCount: { type: "integer" },
      truncated: { type: "boolean" },
      executionTimeMs: { type: "integer" }
    },
    required: ["columns", "rows", "rowCount", "truncated", "executionTimeMs"],
    additionalProperties: false
  } as const;
  private readonly connectionManager: ConnectionManager;
  private readonly validator: SQLValidator;
  private readonly auditLogger: AuditLogger;
  private readonly limits: LimitsConfig;

  constructor(
    connectionManager: ConnectionManager,
    validator: SQLValidator,
    auditLogger: AuditLogger,
    limits: LimitsConfig
  ) {
    this.connectionManager = connectionManager;
    this.validator = validator;
    this.auditLogger = auditLogger;
    this.limits = limits;
  }

  async execute(input: QueryDatabaseInput, context?: { client?: string }): Promise<QueryResult> {
    this.connectionManager.ensureConfigured();
    const validation = this.validator.validate(input.query);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const connectionName = this.connectionManager.resolveConnectionName(input.connection_name);
    const driver = this.connectionManager.resolveConnection(connectionName);
    const applied = QueryPolicy.clampLimits(input, this.limits);
    const started = Date.now();
    const result = await driver.execute(input.query, {
      limit: applied.limit,
      timeoutMs: applied.timeoutMs,
      maxExecutionTimeMs: applied.maxExecutionTimeMs
    });

    const limited = QueryPolicy.applyResultLimits(
      {
        ...result,
        executionTimeMs: Math.max(result.executionTimeMs, Date.now() - started)
      },
      this.limits
    );

    this.auditLogger.log({
      timestamp: new Date().toISOString(),
      connection_name: connectionName,
      query: input.query,
      row_count: limited.rowCount,
      execution_time: `${limited.executionTimeMs}ms`,
      client: context?.client ?? "unknown"
    });

    return limited;
  }
}
