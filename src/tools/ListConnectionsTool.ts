import type { ConnectionInfo } from "../types/connection.ts";
import { ConnectionManager } from "../database/pool/ConnectionManager.ts";
import type { ToolDefinition } from "./ITool.ts";

export class ListConnectionsTool implements ToolDefinition<Record<string, never>, ConnectionInfo[]> {
  readonly name = "list_connections";
  readonly description = "List configured database connections";
  readonly inputSchema = {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false
  } as const;
  readonly outputSchema = {
    type: "array",
    description: "Configured database connections available to the MCP server.",
    items: {
      type: "object",
      properties: {
        name: { type: "string" },
        type: { type: "string" },
        host: { type: "string" },
        port: { type: "integer" },
        database: { type: "string" },
        aliases: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["name", "type", "host", "port", "database"],
      additionalProperties: false
    }
  } as const;
  private readonly connectionManager: ConnectionManager;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  async execute(): Promise<ConnectionInfo[]> {
    return this.connectionManager.listConnections();
  }
}
