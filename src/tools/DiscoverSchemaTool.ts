import { ConnectionManager } from "../database/pool/ConnectionManager.ts";
import { SchemaCache } from "../schema/SchemaCache.ts";
import { SchemaService } from "../schema/SchemaService.ts";
import type { DiscoverSchemaInput, SchemaOverview } from "../types/schema.ts";
import type { ToolDefinition } from "./ITool.ts";

export class DiscoverSchemaTool implements ToolDefinition<DiscoverSchemaInput, SchemaOverview> {
  readonly name = "discover_schema";
  readonly description = "Discover schema overview";
  readonly inputSchema = {
    type: "object",
    properties: {
      connection_name: {
        type: "string",
        description: "Configured connection name or alias."
      },
      include_patterns: {
        type: "string",
        description: "Optional glob-style include pattern, for example 'order*'."
      },
      exclude_patterns: {
        type: "string",
        description: "Optional comma-separated glob-style exclude patterns."
      },
      depth: {
        type: "integer",
        description: "Discovery depth. Use 1 for table names only."
      }
    },
    required: ["connection_name"],
    additionalProperties: false
  } as const;
  readonly outputSchema = {
    type: "object",
    description: "High-level database schema summary.",
    properties: {
      database: { type: "string" },
      tables: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
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
            }
          },
          required: ["name", "columns"],
          additionalProperties: false
        }
      },
      relationships: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sourceTable: { type: "string" },
            sourceColumn: { type: "string" },
            targetTable: { type: "string" },
            targetColumn: { type: "string" }
          },
          required: ["sourceTable", "sourceColumn", "targetTable", "targetColumn"],
          additionalProperties: false
        }
      },
      truncated: { type: "boolean" },
      message: { type: "string" }
    },
    required: ["database", "tables", "truncated"],
    additionalProperties: false
  } as const;
  private readonly connectionManager: ConnectionManager;
  private readonly schemaService: SchemaService;
  private readonly schemaCache: SchemaCache;

  constructor(connectionManager: ConnectionManager, schemaService: SchemaService, schemaCache: SchemaCache) {
    this.connectionManager = connectionManager;
    this.schemaService = schemaService;
    this.schemaCache = schemaCache;
  }

  private buildCacheKey(input: DiscoverSchemaInput): string {
    return JSON.stringify(input);
  }

  async execute(input: DiscoverSchemaInput): Promise<SchemaOverview> {
    const cacheKey = this.buildCacheKey(input);
    const cached = await this.schemaCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const driver = this.connectionManager.resolveConnection(input.connection_name);
    const result = await this.schemaService.discover(driver, input);
    await this.schemaCache.set(cacheKey, result);
    return result;
  }
}
