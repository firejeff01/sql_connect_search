import { ConnectionManager } from "../database/pool/ConnectionManager.ts";
import { SchemaService } from "../schema/SchemaService.ts";
import type { DescribeTablesInput, TableDescription } from "../types/schema.ts";
import type { ToolDefinition } from "./ITool.ts";

export class DescribeTablesTool implements ToolDefinition<DescribeTablesInput, TableDescription> {
  readonly name = "describe_tables";
  readonly description = "Describe a single table";
  readonly inputSchema = {
    type: "object",
    properties: {
      connection_name: {
        type: "string",
        description: "Configured connection name or alias."
      },
      table_name: {
        type: "string",
        description: "Database table name to inspect."
      }
    },
    required: ["connection_name", "table_name"],
    additionalProperties: false
  } as const;
  readonly outputSchema = {
    type: "object",
    description: "Structural details for one database table.",
    properties: {
      tableName: { type: "string" },
      columns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { type: "string" },
            nullable: { type: "boolean" },
            defaultValue: { description: "Database default value when present." }
          },
          required: ["name", "type", "nullable"],
          additionalProperties: true
        }
      },
      primaryKey: {
        type: "array",
        items: { type: "string" }
      },
      indexes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            columns: {
              type: "array",
              items: { type: "string" }
            },
            unique: { type: "boolean" }
          },
          required: ["name", "columns", "unique"],
          additionalProperties: false
        }
      },
      foreignKeys: {
        type: "array",
        items: {
          type: "object",
          properties: {
            column: { type: "string" },
            referencedTable: { type: "string" },
            referencedColumn: { type: "string" }
          },
          required: ["column", "referencedTable", "referencedColumn"],
          additionalProperties: false
        }
      },
      rowEstimate: { type: "integer" }
    },
    required: ["tableName", "columns", "primaryKey", "indexes"],
    additionalProperties: false
  } as const;
  private readonly connectionManager: ConnectionManager;
  private readonly schemaService: SchemaService;

  constructor(connectionManager: ConnectionManager, schemaService: SchemaService) {
    this.connectionManager = connectionManager;
    this.schemaService = schemaService;
  }

  async execute(input: DescribeTablesInput): Promise<TableDescription> {
    const driver = this.connectionManager.resolveConnection(input.connection_name);
    return this.schemaService.describeTable(driver, input.table_name);
  }
}
