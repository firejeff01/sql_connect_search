import type { ConnectionInfo } from "../types/connection.ts";
import type { RootDescriptor } from "./protocol.ts";

export class RootRegistry {
  createDescriptors(connections: ConnectionInfo[], defaultConnection?: string): RootDescriptor[] {
    const connectionRoots = connections.map((connection) => ({
      uri: `root://connections/${connection.name}`,
      name: `${connection.name} root`,
      description: `Top-level entry for connection '${connection.name}', including schema and query resources.`,
      metadata: {
        kind: "connection" as const,
        preferred: connection.name === defaultConnection,
        connection: {
          name: connection.name,
          type: connection.type,
          database: connection.database,
          aliases: connection.aliases
        },
        related: {
          resources: [`schema://${connection.name}/overview`],
          prompts: ["plan_schema_exploration", "draft_safe_sql_query", "choose_best_tool"],
          tools: ["describe_tables", "discover_schema", "query_database", "list_connections"]
        },
        hints: [
          "Read schema://<connection>/overview before writing SQL when the schema is unclear.",
          "Use describe_tables to confirm columns before query_database."
        ]
      }
    }));

    return [
      {
        uri: "root://connections",
        name: "Connections root",
        description: "Top-level entry for configured database connections.",
        metadata: {
          kind: "connections",
          preferred: true,
          related: {
            tools: ["list_connections"],
            resources: connections.map((connection) => `schema://${connection.name}/overview`)
          },
          hints: ["Start here when the user did not specify which database connection to use."]
        }
      },
      {
        uri: "root://resources",
        name: "Resources root",
        description: "Top-level entry for schema snapshots and reusable templates.",
        metadata: {
          kind: "resources",
          related: {
            resources: [
              ...connections.map((connection) => `schema://${connection.name}/overview`),
              "template://query_database/select_top_rows",
              "template://describe_tables/inspect_table",
              "template://discover_schema/overview"
            ]
          },
          hints: ["Use resources for cached schema context and reusable tool-call templates."]
        }
      },
      {
        uri: "root://prompts",
        name: "Prompts root",
        description: "Top-level entry for reusable MCP prompt templates.",
        metadata: {
          kind: "prompts",
          related: {
            prompts: ["plan_schema_exploration", "draft_safe_sql_query", "choose_best_tool"]
          },
          hints: ["Use prompts when the model needs guidance on the safest next MCP action."]
        }
      },
      ...connectionRoots
    ];
  }
}
