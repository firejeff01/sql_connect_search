import type { ToolDefinition } from "./ITool.ts";

export interface ConfigureMySqlConnectionInput {
  connection_name?: string;
  host: string;
  port?: number;
  database: string;
  username: string;
  password?: string;
  password_env_var?: string;
  aliases?: string[];
  set_as_default?: boolean;
}

export interface ConfigureMySqlConnectionResult {
  configured: boolean;
  connectionName: string;
  configPath: string;
  envPath?: string;
  defaultConnection: string;
  message: string;
}

export class ConfigureMySqlConnectionTool
  implements ToolDefinition<ConfigureMySqlConnectionInput, ConfigureMySqlConnectionResult>
{
  readonly name = "configure_mysql_connection";
  readonly description = "Create or update a MySQL connection and persist it for future MCP sessions.";
  readonly inputSchema = {
    type: "object",
    properties: {
      connection_name: {
        type: "string",
        description: "Connection name to store. Defaults to 'default-mysql'."
      },
      host: {
        type: "string",
        description: "MySQL host name or IP address."
      },
      port: {
        type: "integer",
        description: "MySQL port. Defaults to 3306."
      },
      database: {
        type: "string",
        description: "Target MySQL database name."
      },
      username: {
        type: "string",
        description: "MySQL username."
      },
      password: {
        type: "string",
        description: "Optional password to persist into a local .env file beside the config."
      },
      password_env_var: {
        type: "string",
        description: "Environment variable name referenced by the config. Defaults to MYSQL_LIVE_PASSWORD."
      },
      aliases: {
        type: "array",
        description: "Optional aliases for this connection.",
        items: { type: "string" }
      },
      set_as_default: {
        type: "boolean",
        description: "Whether this connection should become the default connection."
      }
    },
    required: ["host", "database", "username"],
    additionalProperties: false
  } as const;
  readonly outputSchema = {
    type: "object",
    description: "Result of persisting a MySQL connection.",
    properties: {
      configured: { type: "boolean" },
      connectionName: { type: "string" },
      configPath: { type: "string" },
      envPath: { type: "string" },
      defaultConnection: { type: "string" },
      message: { type: "string" }
    },
    required: ["configured", "connectionName", "configPath", "defaultConnection", "message"],
    additionalProperties: false
  } as const;
  private readonly configure: (input: ConfigureMySqlConnectionInput) => Promise<ConfigureMySqlConnectionResult>;

  constructor(configure: (input: ConfigureMySqlConnectionInput) => Promise<ConfigureMySqlConnectionResult>) {
    this.configure = configure;
  }

  async execute(input: ConfigureMySqlConnectionInput): Promise<ConfigureMySqlConnectionResult> {
    return this.configure(input);
  }
}
