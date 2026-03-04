import type { LimitsConfig } from "../config/IConfig.ts";
import { AuditLogger } from "../audit/AuditLogger.ts";
import { ConnectionManager } from "../database/pool/ConnectionManager.ts";
import type { QueryResult } from "../database/drivers/IDriverAdapter.ts";
import { QueryPolicy } from "../security/QueryPolicy.ts";
import { MongoValidator } from "../security/MongoValidator.ts";
import type { MongoDBQueryInput } from "../types/query.ts";
import type { ToolDefinition } from "./ITool.ts";

export class MongoDBQueryTool implements ToolDefinition<MongoDBQueryInput, QueryResult> {
  readonly name = "mongodb_query";
  readonly description = "Execute a read-only MongoDB query";
  readonly inputSchema = {
    type: "object",
    properties: {
      connection_name: {
        type: "string",
        description: "Configured MongoDB connection name or alias."
      },
      collection: {
        type: "string",
        description: "MongoDB collection name."
      },
      operation: {
        type: "string",
        description: "Read-only MongoDB operation.",
        enum: ["find", "aggregate", "countDocuments", "distinct", "listCollections", "listIndexes", "explain"]
      },
      filter: {
        type: "object",
        description: "MongoDB filter document for find/distinct/count operations."
      },
      pipeline: {
        type: "array",
        description: "Aggregation pipeline for aggregate/explain operations.",
        items: {
          type: "object"
        }
      },
      limit: {
        type: "integer",
        description: "Optional result limit. Defaults to 1000 and is clamped by server policy."
      },
      timeout_ms: {
        type: "integer",
        description: "Optional timeout in milliseconds. Defaults to 30000 and is clamped by server policy."
      }
    },
    required: ["collection"],
    additionalProperties: false
  } as const;
  readonly outputSchema = {
    type: "object",
    description: "MongoDB query result normalized into tabular form.",
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
  private readonly validator: MongoValidator;
  private readonly auditLogger: AuditLogger;
  private readonly limits: LimitsConfig;

  constructor(
    connectionManager: ConnectionManager,
    validator: MongoValidator,
    auditLogger: AuditLogger,
    limits: LimitsConfig
  ) {
    this.connectionManager = connectionManager;
    this.validator = validator;
    this.auditLogger = auditLogger;
    this.limits = limits;
  }

  async execute(input: MongoDBQueryInput, context?: { client?: string }): Promise<QueryResult> {
    this.connectionManager.ensureConfigured();
    const operation = input.operation ?? "find";
    const opValidation = this.validator.validateOperation(operation);
    if (!opValidation.valid) {
      throw new Error(opValidation.error);
    }

    const pipelineValidation = this.validator.validatePipeline(input.pipeline);
    if (!pipelineValidation.valid) {
      throw new Error(pipelineValidation.error);
    }

    const connectionName = this.connectionManager.resolveConnectionName(input.connection_name);
    const driver = this.connectionManager.resolveConnection(connectionName);
    if (!driver.executeMongo) {
      throw new Error(`Driver '${driver.getType()}' does not support MongoDB operations`);
    }

    const applied = QueryPolicy.clampLimits(
      {
        limit: input.limit ?? 1000,
        timeout_ms: input.timeout_ms ?? 30000
      },
      this.limits
    );

    const result = await driver.executeMongo(
      input.collection,
      operation,
      {
        filter: input.filter,
        pipeline: input.pipeline
      },
      {
        limit: applied.limit,
        timeoutMs: applied.timeoutMs,
        maxExecutionTimeMs: applied.maxExecutionTimeMs
      }
    );
    const limited = QueryPolicy.applyResultLimits(result, this.limits);

    this.auditLogger.log({
      timestamp: new Date().toISOString(),
      connection_name: connectionName,
      query: JSON.stringify({
        collection: input.collection,
        operation,
        filter: input.filter,
        pipeline: input.pipeline
      }),
      row_count: limited.rowCount,
      execution_time: `${limited.executionTimeMs}ms`,
      client: context?.client ?? "unknown"
    });

    return limited;
  }
}
