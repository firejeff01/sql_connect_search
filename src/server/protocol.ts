import type { JsonSchemaProperty } from "../tools/ITool.ts";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result: unknown;
}

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  error: JsonRpcErrorObject;
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;
export type JsonRpcHandlerResult = JsonRpcResponse | null;

export interface ClientInfo {
  name?: string;
  version?: string;
}

export interface ClientCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    read?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  roots?: {
    listChanged?: boolean;
  };
  sampling?: {
    createMessage?: boolean;
  };
  experimental?: Record<string, unknown>;
}

export interface InitializeParams {
  protocolVersion?: string;
  clientInfo?: ClientInfo;
  capabilities?: ClientCapabilities;
}

export interface InitializeResult {
  protocolVersion: string;
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities: {
    logging?: Record<string, never>;
    tools: {
      listChanged: boolean;
    };
    resources: {
      listChanged: boolean;
      subscribe: boolean;
    };
    prompts: {
      listChanged: boolean;
    };
  };
  instructions: string;
  _meta?: Record<string, unknown>;
}

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  outputSchema: JsonSchemaProperty;
}

export interface ToolsListResult {
  tools: ToolDescriptor[];
}

export interface ToolsCallParams {
  name: string;
  arguments?: Record<string, unknown>;
  client?: string;
}

export interface ToolsCallResult {
  toolName: string;
  metadata: {
    durationMs: number;
    generatedAt: string;
  };
  content: Array<{
    type: "json";
    json: unknown;
  }>;
  isError?: boolean;
}

export interface ResourceDescriptor {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  annotations?: {
    audience?: string[];
    priority?: number;
    lastModified?: string;
    origin?: string;
    cache?: {
      strategy: "persistent_ttl" | "static";
      ttlMs?: number;
    };
  };
}

export interface ResourcesListResult {
  resources: ResourceDescriptor[];
}

export interface ResourcesReadParams {
  uri: string;
}

export interface ResourceContents {
  uri: string;
  mimeType: string;
  text: string;
  metadata?: {
    origin?: string;
    root?: string;
    cacheStatus?: "memory" | "disk" | "miss" | "static";
    generatedAt?: string;
    expiresAt?: string;
  };
}

export interface ResourcesReadResult {
  contents: ResourceContents[];
}

export interface PromptArgumentDescriptor {
  name: string;
  description: string;
  required?: boolean;
}

export interface PromptDescriptor {
  name: string;
  description: string;
  arguments?: PromptArgumentDescriptor[];
}

export interface PromptsListResult {
  prompts: PromptDescriptor[];
}

export interface PromptsGetParams {
  name: string;
  arguments?: Record<string, string>;
}

export interface PromptMessage {
  role: "system" | "user" | "assistant";
  content: {
    type: "text";
    text: string;
  };
}

export interface PromptsGetResult {
  description: string;
  messages: PromptMessage[];
}

export interface RootDescriptor {
  uri: string;
  name: string;
  description: string;
  metadata?: {
    kind?: "connections" | "connection" | "resources" | "prompts";
    preferred?: boolean;
    connection?: {
      name: string;
      type: string;
      database: string;
      aliases?: string[];
    };
    related?: {
      resources?: string[];
      prompts?: string[];
      tools?: string[];
    };
    hints?: string[];
  };
}

export interface RootsListResult {
  roots: RootDescriptor[];
}

export interface JsonRpcErrorData {
  category:
    | "invalid_request"
    | "invalid_params"
    | "not_found"
    | "unauthorized"
    | "rate_limited"
    | "policy_violation"
    | "unsupported"
    | "not_ready"
    | "internal";
  retryable: boolean;
  source?: "transport" | "server" | "tool";
  details?: unknown;
}

export function createJsonRpcSuccess(id: string | number | null, result: unknown): JsonRpcSuccessResponse {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

export function createJsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcErrorResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      data
    }
  };
}

export function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function mapErrorToJsonRpc(error: unknown, source: "transport" | "server" | "tool" = "server"): JsonRpcErrorObject {
  const message = normalizeErrorMessage(error);

  if (error instanceof SyntaxError) {
    return {
      code: -32700,
      message: "Parse error",
      data: {
        category: "invalid_request",
        retryable: false,
        source,
        details: message
      } satisfies JsonRpcErrorData
    };
  }

  if (message.includes("jsonrpc must be '2.0'")) {
    return {
      code: -32600,
      message,
      data: {
        category: "invalid_request",
        retryable: false,
        source
      } satisfies JsonRpcErrorData
    };
  }

  if (
    /requires params\./.test(message) ||
    message === "connection_name is required" ||
    message === "Query is required" ||
    message === "Unable to determine SQL statement type"
  ) {
    return {
      code: -32602,
      message,
      data: {
        category: "invalid_params",
        retryable: false,
        source
      } satisfies JsonRpcErrorData
    };
  }

  if (message.includes("not found") || message.includes("is not registered")) {
    return {
      code: -32004,
      message,
      data: {
        category: "not_found",
        retryable: false,
        source
      } satisfies JsonRpcErrorData
    };
  }

  if (
    message.includes("not allowed") ||
    message.includes("read-only") ||
    message.includes("restricted by server policy") ||
    message.includes("Multiple statements are not allowed")
  ) {
    return {
      code: -32003,
      message,
      data: {
        category: "policy_violation",
        retryable: false,
        source
      } satisfies JsonRpcErrorData
    };
  }

  if (
    message.includes("does not support") ||
    message.includes("Unsupported driver type")
  ) {
    return {
      code: -32005,
      message,
      data: {
        category: "unsupported",
        retryable: false,
        source
      } satisfies JsonRpcErrorData
    };
  }

  if (message === "Server is not initialized" || message.includes("HTTP mode requires at least one API key")) {
    return {
      code: -32050,
      message,
      data: {
        category: "not_ready",
        retryable: false,
        source
      } satisfies JsonRpcErrorData
    };
  }

  return {
    code: -32000,
    message,
    data: {
      category: "internal",
      retryable: false,
      source,
      details: error instanceof Error && error.stack ? { stack: error.stack } : undefined
    } satisfies JsonRpcErrorData
  };
}

export function createJsonRpcErrorFromUnknown(
  id: string | number | null,
  error: unknown,
  source: "transport" | "server" | "tool" = "server"
): JsonRpcErrorResponse {
  const mapped = mapErrorToJsonRpc(error, source);
  return createJsonRpcError(id, mapped.code, mapped.message, mapped.data);
}
