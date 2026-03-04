export interface JsonSchemaProperty {
  type?: "string" | "number" | "integer" | "boolean" | "object" | "array";
  description?: string;
  enum?: string[];
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaProperty;
  items?: JsonSchemaProperty;
}

export interface ToolInputSchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  outputSchema: JsonSchemaProperty;
  execute(input: TInput, context?: { client?: string }): Promise<TOutput>;
}
