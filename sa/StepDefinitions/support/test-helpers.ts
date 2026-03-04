import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { AuditLogger } from "../../../src/audit/AuditLogger.ts";
import { ConfigLoader } from "../../../src/config/ConfigLoader.ts";
import { ConnectionManager } from "../../../src/database/pool/ConnectionManager.ts";
import { CredentialResolver } from "../../../src/credential/CredentialResolver.ts";
import type { ICredentialProvider } from "../../../src/credential/ICredentialProvider.ts";
import { SchemaCache } from "../../../src/schema/SchemaCache.ts";
import { SchemaService } from "../../../src/schema/SchemaService.ts";
import { MongoValidator } from "../../../src/security/MongoValidator.ts";
import { SQLValidator } from "../../../src/security/SQLValidator.ts";
import { DescribeTablesTool } from "../../../src/tools/DescribeTablesTool.ts";
import { DiscoverSchemaTool } from "../../../src/tools/DiscoverSchemaTool.ts";
import { ListConnectionsTool } from "../../../src/tools/ListConnectionsTool.ts";
import { MongoDBQueryTool } from "../../../src/tools/MongoDBQueryTool.ts";
import { QueryDatabaseTool } from "../../../src/tools/QueryDatabaseTool.ts";
import { ToolRegistry } from "../../../src/tools/ToolRegistry.ts";
import type { ServerConfig } from "../../../src/config/IConfig.ts";

export const defaultLimits = {
  max_rows: 1000,
  timeout: 30,
  result_size: 5,
  max_execution_time: 60
};

export function createServerConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    connections: [
      {
        name: "sales-db",
        type: "mssql",
        host: "127.0.0.1",
        port: 1433,
        database: "sales",
        username: "readonly",
        aliases: ["prod_sales_ro"]
      },
      {
        name: "mongo-db",
        type: "mongodb",
        host: "127.0.0.1",
        port: 27017,
        database: "analytics",
        username: "readonly"
      }
    ],
    pool: { max: 10, min: 2, idleTimeout: 30000 },
    limits: defaultLimits,
    audit: { enabled: true },
    http: {
      port: 3000,
      bind: "127.0.0.1",
      api_keys: ["valid-api-key"],
      auth_scheme: "api_key"
    },
    credential: { provider: "env" },
    default_connection: "sales-db",
    ...overrides
  };
}

export async function createConnectionManager(config: ServerConfig): Promise<ConnectionManager> {
  const manager = new ConnectionManager(config.limits, config.default_connection);
  await manager.createPools(config.connections, config.pool);
  return manager;
}

export async function createCoreTools(config: ServerConfig): Promise<{
  connectionManager: ConnectionManager;
  auditLogger: AuditLogger;
  registry: ToolRegistry;
  schemaCache: SchemaCache;
  schemaService: SchemaService;
  queryTool: QueryDatabaseTool;
  mongoTool: MongoDBQueryTool;
  describeTool: DescribeTablesTool;
  discoverTool: DiscoverSchemaTool;
}> {
  const connectionManager = await createConnectionManager(config);
  const auditLogger = new AuditLogger(config.audit, new MemoryWritable());
  const schemaCache = new SchemaCache();
  const schemaService = new SchemaService(config.limits);
  const queryTool = new QueryDatabaseTool(connectionManager, new SQLValidator(), auditLogger, config.limits);
  const mongoTool = new MongoDBQueryTool(connectionManager, new MongoValidator(), auditLogger, config.limits);
  const describeTool = new DescribeTablesTool(connectionManager, schemaService);
  const discoverTool = new DiscoverSchemaTool(connectionManager, schemaService, schemaCache);
  const registry = new ToolRegistry();
  registry.registerTools([
    new ListConnectionsTool(connectionManager),
    describeTool,
    queryTool,
    mongoTool,
    discoverTool
  ]);

  return {
    connectionManager,
    auditLogger,
    registry,
    schemaCache,
    schemaService,
    queryTool,
    mongoTool,
    describeTool,
    discoverTool
  };
}

export class MemoryWritable extends Writable {
  private chunks: string[] = [];

  _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(chunk.toString());
    callback();
  }

  toString(): string {
    return this.chunks.join("");
  }
}

export async function writeTempConfig(config: ServerConfig, envContent?: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sa-steps-"));
  if (envContent !== undefined) {
    await writeFile(join(dir, ".env"), envContent, "utf8");
  }
  const configPath = join(dir, "config.yaml");
  await writeFile(configPath, JSON.stringify(config), "utf8");
  return configPath;
}

export function createCustomProvider(password: string): ICredentialProvider {
  return {
    async resolve(): Promise<{ resolved: boolean; password: string }> {
      return { resolved: true, password };
    }
  };
}

export async function createAesFile(account: string, password: string, masterKey: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aes-steps-"));
  const filePath = join(dir, "secrets.json");
  const key = createHash("sha256").update(masterKey).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  await writeFile(
    filePath,
    JSON.stringify({
      [account]: {
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        data: encrypted.toString("base64")
      }
    }),
    "utf8"
  );
  return filePath;
}

export function createConfigLoader(resolver?: CredentialResolver): ConfigLoader {
  return new ConfigLoader(resolver);
}
