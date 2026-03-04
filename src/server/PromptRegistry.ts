import type { ConnectionInfo } from "../types/connection.ts";
import type { PromptDescriptor, PromptsGetResult } from "./protocol.ts";

export class PromptRegistry {
  createDescriptors(): PromptDescriptor[] {
    return [
      {
        name: "plan_schema_exploration",
        description: "Guide the model to inspect available schema resources before querying data.",
        arguments: [
          {
            name: "connection_name",
            description: "Configured connection name to inspect first.",
            required: false
          }
        ]
      },
      {
        name: "draft_safe_sql_query",
        description: "Guide the model to build a read-only SQL tool call using the discovered schema.",
        arguments: [
          {
            name: "connection_name",
            description: "Configured connection name to query.",
            required: true
          },
          {
            name: "table_name",
            description: "Primary table name to query.",
            required: true
          },
          {
            name: "user_goal",
            description: "Plain-language task the SQL query should satisfy.",
            required: true
          }
        ]
      },
      {
        name: "choose_best_tool",
        description: "Guide the model to pick between schema discovery, table description, and query execution.",
        arguments: [
          {
            name: "user_goal",
            description: "What the end user is asking for.",
            required: true
          }
        ]
      }
    ];
  }

  getPrompt(name: string, args: Record<string, string> | undefined, connections: ConnectionInfo[]): PromptsGetResult {
    switch (name) {
      case "plan_schema_exploration":
        return {
          description: "Suggest a safe first-pass exploration workflow.",
          messages: [
            {
              role: "system",
              content: {
                type: "text",
                text: this.buildSchemaExplorationPrompt(args?.connection_name, connections)
              }
            }
          ]
        };
      case "draft_safe_sql_query":
        return {
          description: "Suggest how to draft a read-only SQL tool call.",
          messages: [
            {
              role: "system",
              content: {
                type: "text",
                text: this.buildDraftQueryPrompt(args)
              }
            }
          ]
        };
      case "choose_best_tool":
        return {
          description: "Suggest which MCP tool or resource to use next.",
          messages: [
            {
              role: "system",
              content: {
                type: "text",
                text: this.buildToolSelectionPrompt(args?.user_goal)
              }
            }
          ]
        };
      default:
        throw new Error(`Prompt '${name}' was not found`);
    }
  }

  private buildSchemaExplorationPrompt(connectionName: string | undefined, connections: ConnectionInfo[]): string {
    const availableConnections =
      connections.length > 0 ? connections.map((connection) => connection.name).join(", ") : "none";
    const preferredConnection = connectionName ?? connections[0]?.name ?? "<connection_name>";
    return [
      "Inspect this MCP server in a conservative order.",
      `Available connections: ${availableConnections}.`,
      `Start with resources/read on schema://${preferredConnection}/overview if that resource exists.`,
      "If the schema overview is too broad, call discover_schema with include_patterns and depth=1.",
      "Use describe_tables before query_database when column names or keys are uncertain.",
      "Only generate read-only SQL."
    ].join(" ");
  }

  private buildDraftQueryPrompt(args: Record<string, string> | undefined): string {
    const connectionName = args?.connection_name ?? "<connection_name>";
    const tableName = args?.table_name ?? "<table_name>";
    const userGoal = args?.user_goal ?? "<user_goal>";
    return [
      "Draft a tools/call request for query_database.",
      `Use connection_name='${connectionName}' and table='${tableName}'.`,
      `Satisfy this goal: ${userGoal}.`,
      "Prefer SELECT with explicit columns when the schema is known.",
      "Add LIMIT unless the user explicitly needs a full result set.",
      "Do not use write operations, DDL, comments, or multi-statement SQL."
    ].join(" ");
  }

  private buildToolSelectionPrompt(userGoal: string | undefined): string {
    return [
      `User goal: ${userGoal ?? "<user_goal>"}.`,
      "Choose list_connections when the target database is unclear.",
      "Choose resources/read on schema://.../overview or discover_schema for broad structural context.",
      "Choose describe_tables for one specific table.",
      "Choose query_database only after the schema is sufficiently understood.",
      "State the next MCP method and why it is the safest useful step."
    ].join(" ");
  }
}
