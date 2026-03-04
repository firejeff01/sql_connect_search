import type { LimitsConfig } from "../../config/IConfig.ts";
import type { ConnectionCapabilities, ConnectionConfig, ConnectionInfo, PoolConfig } from "../../types/connection.ts";
import { SetupRequiredError } from "../../errors/SetupRequiredError.ts";
import { DriverFactory } from "../drivers/DriverFactory.ts";
import type { IDriverAdapter } from "../drivers/IDriverAdapter.ts";
import { ConnectionPool } from "./ConnectionPool.ts";

export class ConnectionManager {
  private readonly pools = new Map<string, ConnectionPool>();
  private readonly aliases = new Map<string, string>();
  private readonly connections = new Map<string, ConnectionConfig>();
  private readonly limits: LimitsConfig;
  private readonly defaultConnection?: string;

  constructor(limits: LimitsConfig, defaultConnection?: string) {
    this.limits = limits;
    this.defaultConnection = defaultConnection;
  }

  async createPools(connections: ConnectionConfig[], poolConfig: PoolConfig): Promise<void> {
    for (const connection of connections) {
      const driver = DriverFactory.createDriver(connection.type);
      await driver.connect(connection);
      const pool = new ConnectionPool(driver, poolConfig, () => {
        this.pools.delete(connection.name);
      });
      await pool.initialize();
      this.pools.set(connection.name, pool);
      this.connections.set(connection.name, connection);
      for (const alias of connection.aliases ?? []) {
        this.aliases.set(alias, connection.name);
      }
    }
  }

  async destroyPools(): Promise<void> {
    const pools = [...this.pools.values()];
    this.pools.clear();
    this.aliases.clear();
    this.connections.clear();
    await Promise.all(pools.map((pool) => pool.destroy()));
  }

  hasConnections(): boolean {
    return this.connections.size > 0;
  }

  ensureConfigured(): void {
    if (!this.hasConnections()) {
      throw new SetupRequiredError("No database connections are configured yet.", {
        suggestedTool: "configure_mysql_connection",
        missingFields: ["host", "port", "database", "username", "password"],
        suggestedConnectionType: "mysql2"
      });
    }
  }

  listConnections(): ConnectionInfo[] {
    return [...this.connections.values()].map((connection) => ({
      name: connection.name,
      type: connection.type,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      aliases: connection.aliases
    }));
  }

  getPool(name: string): ConnectionPool | undefined {
    return this.pools.get(name);
  }

  getDefaultConnectionName(): string | undefined {
    return this.defaultConnection;
  }

  resolveConnection(name?: string): IDriverAdapter {
    const actualName = name ?? this.defaultConnection;
    if (!actualName) {
      throw new Error("connection_name is required");
    }
    this.ensureConfigured();

    const resolvedName = this.aliases.get(actualName) ?? actualName;
    const pool = this.pools.get(resolvedName);
    if (!pool) {
      throw new Error(`Connection '${actualName}' not found`);
    }
    return pool.getDriver();
  }

  resolveConnectionName(name?: string): string {
    const actualName = name ?? this.defaultConnection;
    if (!actualName) {
      throw new Error("connection_name is required");
    }
    return this.aliases.get(actualName) ?? actualName;
  }

  getCapabilities(name: string): ConnectionCapabilities {
    const resolvedName = this.resolveConnectionName(name);
    if (!this.connections.has(resolvedName)) {
      throw new Error(`Connection '${name}' not found`);
    }
    return {
      supportedTools: ["list_connections", "describe_tables", "query_database", "mongodb_query", "discover_schema"],
      readOnly: true,
      maxRows: this.limits.max_rows,
      allowedSchemas: ["public", "dbo"]
    };
  }
}
