import type { ToolDefinition } from "./ITool.ts";

export interface SetupStatusResult {
  configured: boolean;
  configPath: string;
  configExists: boolean;
  connectionCount: number;
  defaultConnection?: string;
  missingFields: string[];
  message: string;
}

export class GetSetupStatusTool implements ToolDefinition<Record<string, never>, SetupStatusResult> {
  readonly name = "get_setup_status";
  readonly description = "Check whether this MCP server already has a usable database configuration.";
  readonly inputSchema = {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false
  } as const;
  readonly outputSchema = {
    type: "object",
    description: "Current setup state for database access.",
    properties: {
      configured: { type: "boolean" },
      configPath: { type: "string" },
      configExists: { type: "boolean" },
      connectionCount: { type: "integer" },
      defaultConnection: { type: "string" },
      missingFields: {
        type: "array",
        items: { type: "string" }
      },
      message: { type: "string" }
    },
    required: ["configured", "configPath", "configExists", "connectionCount", "missingFields", "message"],
    additionalProperties: false
  } as const;
  private readonly getStatus: () => SetupStatusResult;

  constructor(getStatus: () => SetupStatusResult) {
    this.getStatus = getStatus;
  }

  async execute(): Promise<SetupStatusResult> {
    return this.getStatus();
  }
}
