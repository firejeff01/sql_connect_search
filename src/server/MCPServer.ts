import { dirname, resolve } from "node:path";
import type { ServerConfig } from "../config/IConfig.ts";
import { AuditLogger } from "../audit/AuditLogger.ts";
import { configFileExists } from "../config/DefaultConfigPaths.ts";
import { ConfigLoader } from "../config/ConfigLoader.ts";
import { createDefaultServerConfig, saveConfig, savePasswordEnvFile, upsertConnection } from "../config/ConfigStore.ts";
import { ConnectionManager } from "../database/pool/ConnectionManager.ts";
import { CredentialResolver } from "../credential/CredentialResolver.ts";
import { SetupRequiredError } from "../errors/SetupRequiredError.ts";
import { MongoValidator } from "../security/MongoValidator.ts";
import { SQLValidator } from "../security/SQLValidator.ts";
import { SchemaCache } from "../schema/SchemaCache.ts";
import { SchemaService } from "../schema/SchemaService.ts";
import { ConfigureMySqlConnectionTool, type ConfigureMySqlConnectionInput } from "../tools/ConfigureMySqlConnectionTool.ts";
import { DescribeTablesTool } from "../tools/DescribeTablesTool.ts";
import { DiscoverSchemaTool } from "../tools/DiscoverSchemaTool.ts";
import { GetSetupStatusTool, type SetupStatusResult } from "../tools/GetSetupStatusTool.ts";
import type { ToolDefinition } from "../tools/ITool.ts";
import { ListConnectionsTool } from "../tools/ListConnectionsTool.ts";
import { MongoDBQueryTool } from "../tools/MongoDBQueryTool.ts";
import { QueryDatabaseTool } from "../tools/QueryDatabaseTool.ts";
import { ToolRegistry } from "../tools/ToolRegistry.ts";
import { HttpTransport } from "./HttpTransport.ts";
import { PromptRegistry } from "./PromptRegistry.ts";
import { ResourceRegistry } from "./ResourceRegistry.ts";
import { RootRegistry } from "./RootRegistry.ts";
import {
  createJsonRpcError,
  createJsonRpcErrorFromUnknown,
  createJsonRpcSuccess,
  type InitializeParams,
  type InitializeResult,
  type JsonRpcHandlerResult,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type PromptsGetParams,
  type PromptsGetResult,
  type PromptsListResult,
  type RootsListResult,
  type ResourcesListResult,
  type ResourcesReadParams,
  type ResourcesReadResult,
  type ToolDescriptor,
  type ToolsCallParams,
  type ToolsCallResult,
  type ToolsListResult
} from "./protocol.ts";
import { StdioTransport } from "./StdioTransport.ts";

export interface ServerStartOptions {
  configPath: string;
  http?: boolean;
  port?: number;
  bind?: string;
}

export class MCPServer {
  private readonly schemaCacheTtlMs = 10 * 60 * 1000;
  private status = "stopped";
  private transport?: StdioTransport | HttpTransport;
  private config?: ServerConfig;
  private readonly toolRegistry = new ToolRegistry();
  private readonly promptRegistry = new PromptRegistry();
  private readonly resourceRegistry = new ResourceRegistry();
  private readonly rootRegistry = new RootRegistry();
  private readonly credentialResolver = new CredentialResolver();
  private connectionManager?: ConnectionManager;
  private auditLogger?: AuditLogger;
  private schemaService?: SchemaService;
  private schemaCache?: SchemaCache;
  private initializedClient?: InitializeParams;
  private configPath?: string;
  private configExistsOnDisk = false;

  getStatus(): string {
    return this.status;
  }

  getTransportType(): string | undefined {
    return this.transport?.type;
  }

  getPort(): number | undefined {
    return this.transport instanceof HttpTransport ? this.transport.port : undefined;
  }

  getBindAddress(): string | undefined {
    return this.transport instanceof HttpTransport ? this.transport.bindAddress : undefined;
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  getConnectionManager(): ConnectionManager | undefined {
    return this.connectionManager;
  }

  getAuditLogger(): AuditLogger | undefined {
    return this.auditLogger;
  }

  private getRuntimeConfig(): ServerConfig {
    if (!this.config) {
      throw new Error("Server is not initialized");
    }
    return this.config;
  }

  private getSetupStatus(): SetupStatusResult {
    const config = this.config ?? createDefaultServerConfig();
    const connectionCount = config.connections.length;
    return {
      configured: connectionCount > 0,
      configPath: this.configPath ?? "",
      configExists: this.configExistsOnDisk,
      connectionCount,
      defaultConnection: config.default_connection,
      missingFields: connectionCount > 0 ? [] : ["host", "port", "database", "username", "password"],
      message:
        connectionCount > 0
          ? "At least one database connection is configured."
          : "No database connections are configured yet. Use configure_mysql_connection before running schema discovery or queries."
    };
  }

  private detectHostKind(params?: InitializeParams): "claude_desktop" | "openai" | "generic" {
    const clientName = params?.clientInfo?.name?.toLowerCase() ?? "";
    if (clientName.includes("claude")) {
      return "claude_desktop";
    }
    if (clientName.includes("openai") || clientName.includes("chatgpt")) {
      return "openai";
    }
    return "generic";
  }

  private createCompatibilityNotes(hostKind: "claude_desktop" | "openai" | "generic"): string[] {
    switch (hostKind) {
      case "claude_desktop":
        return [
          "Use roots/list and resources/read early because this host usually benefits from explicit context resources.",
          "notifications/initialized is supported."
        ];
      case "openai":
        return [
          "Tool schemas and resource metadata are exposed for tool-oriented orchestration.",
          "Notifications are accepted but are optional for typical request/response flows."
        ];
      default:
        return [
          "Initialize with clientInfo and capabilities when possible so the server can negotiate features more precisely."
        ];
    }
  }

  private createInitializeResult(params?: InitializeParams): InitializeResult {
    const acceptedProtocolVersion = params?.protocolVersion?.trim() || "2024-11-05";
    const hostKind = this.detectHostKind(params);
    return {
      protocolVersion: acceptedProtocolVersion,
      serverInfo: {
        name: "sql-connect-search",
        version: "0.1.0"
      },
      capabilities: {
        logging: {},
        tools: {
          listChanged: false
        },
        resources: {
          listChanged: false,
          subscribe: false
        },
        prompts: {
          listChanged: false
        }
      },
      instructions:
        this.getSetupStatus().configured
          ? "Use resources/read for schema context before tools/call when the table layout is unclear. Only issue read-only SQL."
          : "If the user wants database access and no connection is configured yet, call get_setup_status or configure_mysql_connection before running database tools.",
      _meta: {
        acceptedProtocolVersion,
        acknowledgedClientInfo: params?.clientInfo,
        acknowledgedClientCapabilities: params?.capabilities,
        compatibilityProfile: {
          hostKind,
          notes: this.createCompatibilityNotes(hostKind)
        },
        negotiatedCapabilities: {
          notifications: {
            initialized: true,
            cancelled: true
          },
          ping: true,
          tools: {
            listChanged: false
          },
          resources: {
            read: params?.capabilities?.resources?.read !== false,
            subscribe: false,
            listChanged: false
          },
          prompts: {
            listChanged: false
          },
          roots: {
            listChanged: params?.capabilities?.roots?.listChanged === true
          },
          sampling: {
            createMessage: false
          }
        }
      }
    };
  }

  private createToolDescriptor(tool: ToolDefinition<unknown, unknown>): ToolDescriptor {
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema
    };
  }

  private createToolsListResult(): ToolsListResult {
    return {
      tools: this.toolRegistry.getRegisteredTools().map((tool) => this.createToolDescriptor(tool))
    };
  }

  private createResourcesListResult(): ResourcesListResult {
    if (!this.connectionManager) {
      throw new Error("Server is not initialized");
    }

    return {
      resources: this.resourceRegistry.createDescriptors(this.connectionManager.listConnections(), this.schemaCacheTtlMs)
    };
  }

  private createPromptsListResult(): PromptsListResult {
    return {
      prompts: this.promptRegistry.createDescriptors()
    };
  }

  private createRootsListResult(): RootsListResult {
    if (!this.connectionManager) {
      throw new Error("Server is not initialized");
    }

    return {
      roots: this.rootRegistry.createDescriptors(
        this.connectionManager.listConnections(),
        this.connectionManager.getDefaultConnectionName()
      )
    };
  }

  async handleResourcesRead(params: ResourcesReadParams): Promise<ResourcesReadResult> {
    if (!params.uri) {
      throw new Error("resources/read requires params.uri");
    }

    const template = this.resourceRegistry.getTemplatePayload(params.uri);
    if (template) {
      return {
        contents: [template]
      };
    }

    if (!params.uri.startsWith("schema://") || !params.uri.endsWith("/overview")) {
      throw new Error(`Resource '${params.uri}' was not found`);
    }

    if (!this.connectionManager || !this.schemaService || !this.schemaCache) {
      throw new Error("Server is not initialized");
    }

    const connectionName = params.uri.slice("schema://".length, -"/overview".length);
    const resolvedConnectionName = this.connectionManager.resolveConnectionName(connectionName);
    const cacheKey = JSON.stringify({
      connection_name: resolvedConnectionName,
      depth: 1
    });
    const cacheEntry = await this.schemaCache.getEntry(cacheKey);
    const schema =
      cacheEntry?.value ??
      (await this.schemaService.discover(this.connectionManager.resolveConnection(resolvedConnectionName), {
        connection_name: resolvedConnectionName,
        depth: 1
      }));

    let metadata: {
      cacheStatus: "memory" | "disk" | "miss";
      generatedAt: string;
      expiresAt: string;
    };

    if (!cacheEntry) {
      await this.schemaCache.set(cacheKey, schema);
      metadata = {
        cacheStatus: "miss",
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.schemaCacheTtlMs).toISOString()
      };
    } else {
      metadata = {
        cacheStatus: cacheEntry.source,
        generatedAt: new Date(cacheEntry.createdAt).toISOString(),
        expiresAt: new Date(cacheEntry.expiresAt).toISOString()
      };
    }

    return {
      contents: [this.resourceRegistry.createSchemaContents(resolvedConnectionName, schema, metadata)]
    };
  }

  async handlePromptsGet(params: PromptsGetParams): Promise<PromptsGetResult> {
    if (!params.name) {
      throw new Error("prompts/get requires params.name");
    }

    return this.promptRegistry.getPrompt(params.name, params.arguments, this.connectionManager?.listConnections() ?? []);
  }

  async handleToolsCall(params: ToolsCallParams): Promise<ToolsCallResult> {
    if (!params.name) {
      throw new Error("tools/call requires params.name");
    }

    const started = Date.now();
    const result = await this.toolRegistry.executeTool(params.name, params.arguments ?? {}, {
      client: params.client ?? "unknown"
    });

    return {
      toolName: params.name,
      metadata: {
        durationMs: Math.max(0, Date.now() - started),
        generatedAt: new Date().toISOString()
      },
      content: [
        {
          type: "json",
          json: result
        }
      ]
    };
  }

  private async applyConfig(config: ServerConfig): Promise<void> {
    if (this.connectionManager) {
      await this.connectionManager.destroyPools();
    }

    this.config = config;
    this.connectionManager = new ConnectionManager(config.limits, config.default_connection);
    await this.connectionManager.createPools(config.connections, config.pool);
    this.auditLogger = new AuditLogger(config.audit);
    this.schemaService = new SchemaService(config.limits);
    this.schemaCache = new SchemaCache(
      this.schemaCacheTtlMs,
      resolve(dirname(this.configPath ?? resolve("config/default.yaml")), ".schema-cache")
    );

    this.toolRegistry.clear();
    this.registerTools();
  }

  private registerTools(): void {
    if (!this.connectionManager || !this.auditLogger || !this.schemaService || !this.schemaCache || !this.configPath) {
      throw new Error("Server is not initialized");
    }

    const sqlValidator = new SQLValidator();
    const mongoValidator = new MongoValidator();
    const configPath = this.configPath;

    this.toolRegistry.registerTools([
      new GetSetupStatusTool(() => this.getSetupStatus()),
      new ConfigureMySqlConnectionTool((input) => this.configureMySqlConnection(input)),
      new ListConnectionsTool(this.connectionManager),
      new DescribeTablesTool(this.connectionManager, this.schemaService),
      new QueryDatabaseTool(this.connectionManager, sqlValidator, this.auditLogger, this.config!.limits),
      new MongoDBQueryTool(this.connectionManager, mongoValidator, this.auditLogger, this.config!.limits),
      new DiscoverSchemaTool(this.connectionManager, this.schemaService, this.schemaCache)
    ]);
  }

  private async configureMySqlConnection(
    input: ConfigureMySqlConnectionInput
  ): Promise<{
    configured: boolean;
    connectionName: string;
    configPath: string;
    envPath?: string;
    defaultConnection: string;
    message: string;
  }> {
    const currentConfig = this.getRuntimeConfig();
    const connectionName = input.connection_name?.trim() || "default-mysql";
    const passwordEnvVar = input.password_env_var?.trim() || "MYSQL_LIVE_PASSWORD";
    const nextConfig = upsertConnection(
      currentConfig,
      {
        name: connectionName,
        type: "mysql2",
        host: input.host,
        port: input.port ?? 3306,
        database: input.database,
        username: input.username,
        passwordRef: `\${${passwordEnvVar}}`,
        aliases: input.aliases?.filter((item) => item.trim().length > 0)
      },
      input.set_as_default ?? true
    );

    if (input.password) {
      await savePasswordEnvFile(this.configPath!, passwordEnvVar, input.password);
      process.env[passwordEnvVar] = input.password;
    }

    await saveConfig(this.configPath!, nextConfig);
    this.configExistsOnDisk = true;
    const loader = new ConfigLoader(this.credentialResolver);
    const reloaded = await loader.loadConfig(this.configPath!);
    await this.applyConfig(reloaded);

    return {
      configured: true,
      connectionName,
      configPath: this.configPath!,
      envPath: input.password ? resolve(dirname(this.configPath!), ".env") : undefined,
      defaultConnection: this.getRuntimeConfig().default_connection ?? connectionName,
      message: "MySQL connection saved. Database tools can now be used."
    };
  }

  async handleProtocolMessage(request: JsonRpcRequest): Promise<JsonRpcHandlerResult> {
    const id = request.id ?? null;
    const isNotification = request.id === undefined;

    try {
      if (request.jsonrpc !== "2.0") {
        if (isNotification) {
          return null;
        }
        return createJsonRpcError(id, -32600, "Invalid Request", {
          category: "invalid_request",
          retryable: false,
          source: "server",
          details: "jsonrpc must be '2.0'"
        });
      }

      switch (request.method) {
        case "initialize":
          this.initializedClient = (request.params ?? {}) as InitializeParams;
          return isNotification ? null : createJsonRpcSuccess(id, this.createInitializeResult(this.initializedClient));
        case "ping":
          return isNotification ? null : createJsonRpcSuccess(id, {});
        case "notifications/initialized":
        case "notifications/cancelled":
          return null;
        case "tools/list":
          return isNotification ? null : createJsonRpcSuccess(id, this.createToolsListResult());
        case "tools/call":
          return isNotification
            ? (await this.handleToolsCall((request.params ?? {}) as unknown as ToolsCallParams), null)
            : createJsonRpcSuccess(
                id,
                await this.handleToolsCall((request.params ?? {}) as unknown as ToolsCallParams)
              );
        case "resources/list":
          return isNotification ? null : createJsonRpcSuccess(id, this.createResourcesListResult());
        case "resources/read":
          return isNotification
            ? (await this.handleResourcesRead((request.params ?? {}) as unknown as ResourcesReadParams), null)
            : createJsonRpcSuccess(
                id,
                await this.handleResourcesRead((request.params ?? {}) as unknown as ResourcesReadParams)
              );
        case "prompts/list":
          return isNotification ? null : createJsonRpcSuccess(id, this.createPromptsListResult());
        case "prompts/get":
          return isNotification
            ? (await this.handlePromptsGet((request.params ?? {}) as unknown as PromptsGetParams), null)
            : createJsonRpcSuccess(
                id,
                await this.handlePromptsGet((request.params ?? {}) as unknown as PromptsGetParams)
              );
        case "roots/list":
          return isNotification ? null : createJsonRpcSuccess(id, this.createRootsListResult());
        default:
          if (isNotification) {
            return null;
          }
          return createJsonRpcError(id, -32601, `Method '${request.method}' not found`, {
            category: "not_found",
            retryable: false,
            source: "server"
          });
      }
    } catch (error) {
      if (!isNotification && error instanceof SetupRequiredError) {
        return createJsonRpcError(id, -32050, error.message, {
          category: "not_ready",
          retryable: false,
          source: "tool",
          details: {
            ...error.details,
            setupStatus: this.getSetupStatus()
          }
        });
      }
      return isNotification ? null : createJsonRpcErrorFromUnknown(id, error, "server");
    }
  }

  async start(options: ServerStartOptions): Promise<void> {
    const absoluteConfigPath = resolve(options.configPath);
    this.configPath = absoluteConfigPath;
    this.configExistsOnDisk = await configFileExists(absoluteConfigPath);
    const loader = new ConfigLoader(this.credentialResolver);
    const loaded = this.configExistsOnDisk ? await loader.loadConfig(absoluteConfigPath) : createDefaultServerConfig();
    const config = {
      ...loaded,
      http: loaded.http
        ? {
            ...loaded.http,
            port: options.port ?? loaded.http.port,
            bind: options.bind ?? loaded.http.bind
          }
        : loaded.http
    };

    await this.applyConfig(config);

    if (options.http) {
      if (!this.config?.http?.api_keys?.length) {
        throw new Error("HTTP mode requires at least one API key");
      }
      this.transport = new HttpTransport(this.config.http);
      await this.transport.start((request) => this.handleProtocolMessage(request));
    } else {
      this.transport = new StdioTransport();
    }

    this.status = "running";
  }

  async runStdioLoop(): Promise<void> {
    if (!(this.transport instanceof StdioTransport)) {
      throw new Error("STDIO loop is only available for stdio transport");
    }
    await this.transport.startLoop((request) => this.handleProtocolMessage(request));
  }

  async stop(): Promise<void> {
    if (this.transport instanceof HttpTransport) {
      await this.transport.stop();
    }
    this.status = "stopped";
  }
}
