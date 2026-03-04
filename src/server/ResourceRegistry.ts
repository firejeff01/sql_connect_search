import type { ConnectionInfo } from "../types/connection.ts";
import type { SchemaOverview } from "../types/schema.ts";
import type { ResourceDescriptor, ResourceContents } from "./protocol.ts";

export interface ResourceTemplate {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  payload: Record<string, unknown>;
}

export class ResourceRegistry {
  createDescriptors(connections: ConnectionInfo[], cacheTtlMs: number): ResourceDescriptor[] {
    const schemaResources = connections.map((connection) => ({
      uri: `schema://${connection.name}/overview`,
      name: `${connection.name} schema overview`,
      description: `Cached schema overview for connection '${connection.name}'.`,
      mimeType: "application/json",
      annotations: {
        audience: ["assistant"],
        priority: 1,
        origin: `root://connections/${connection.name}`,
        cache: {
          strategy: "persistent_ttl" as const,
          ttlMs: cacheTtlMs
        }
      }
    }));

    return [...schemaResources, ...this.getTemplateDescriptors()];
  }

  createSchemaContents(
    connectionName: string,
    schema: SchemaOverview,
    metadata: {
      cacheStatus: "memory" | "disk" | "miss";
      generatedAt: string;
      expiresAt: string;
    }
  ): ResourceContents {
    return {
      uri: `schema://${connectionName}/overview`,
      mimeType: "application/json",
      metadata: {
        origin: `root://connections/${connectionName}`,
        root: `root://connections/${connectionName}`,
        cacheStatus: metadata.cacheStatus,
        generatedAt: metadata.generatedAt,
        expiresAt: metadata.expiresAt
      },
      text: JSON.stringify(
        {
          connection: connectionName,
          kind: "schema_overview",
          schema
        },
        null,
        2
      )
    };
  }

  getTemplatePayload(uri: string): ResourceContents | undefined {
    const template = this.getTemplates().find((item) => item.uri === uri);
    if (!template) {
      return undefined;
    }

    return {
      uri: template.uri,
      mimeType: template.mimeType,
      metadata: {
        origin: "root://resources",
        root: "root://resources",
        cacheStatus: "static"
      },
      text: JSON.stringify(template.payload, null, 2)
    };
  }

  private getTemplateDescriptors(): ResourceDescriptor[] {
    return this.getTemplates().map((template) => ({
      uri: template.uri,
      name: template.name,
      description: template.description,
      mimeType: template.mimeType,
      annotations: {
        audience: ["assistant"],
        priority: 0,
        origin: "root://resources",
        cache: {
          strategy: "static" as const
        }
      }
    }));
  }

  private getTemplates(): ResourceTemplate[] {
    return [
      {
        uri: "template://query_database/select_top_rows",
        name: "SQL top rows template",
        description: "Suggested tool call for sampling rows from one SQL table.",
        mimeType: "application/json",
        payload: {
          tool: "query_database",
          arguments: {
            connection_name: "<connection_name>",
            query: "SELECT * FROM `<table_name>` LIMIT 5",
            limit: 5
          },
          notes: ["Replace <connection_name> and <table_name> before execution."]
        }
      },
      {
        uri: "template://describe_tables/inspect_table",
        name: "Describe table template",
        description: "Suggested tool call for inspecting one table definition.",
        mimeType: "application/json",
        payload: {
          tool: "describe_tables",
          arguments: {
            connection_name: "<connection_name>",
            table_name: "<table_name>"
          }
        }
      },
      {
        uri: "template://discover_schema/overview",
        name: "Schema overview template",
        description: "Suggested tool call for reading a narrowed schema overview.",
        mimeType: "application/json",
        payload: {
          tool: "discover_schema",
          arguments: {
            connection_name: "<connection_name>",
            include_patterns: "<optional-pattern>",
            depth: 1
          },
          notes: ["Use include_patterns when the schema is large."]
        }
      }
    ];
  }
}
