import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { stringify } from "yaml";
import type { ServerConfig } from "./IConfig.ts";
import type { ConnectionConfig } from "../types/connection.ts";

function parseEnvFile(input: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator < 0) {
      continue;
    }
    entries.set(trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim());
  }
  return entries;
}

export function createDefaultServerConfig(): ServerConfig {
  return {
    connections: [],
    pool: {
      max: 10,
      min: 1,
      idleTimeout: 30000
    },
    limits: {
      max_rows: 1000,
      timeout: 30,
      result_size: 5,
      max_execution_time: 60
    },
    audit: {
      enabled: true
    },
    credential: {
      provider: "env"
    }
  };
}

export function upsertConnection(
  config: ServerConfig,
  connection: ConnectionConfig,
  setAsDefault = true
): ServerConfig {
  const existingConnections = config.connections.filter((item) => item.name !== connection.name);
  const nextConnections = [...existingConnections, connection];
  return {
    ...config,
    connections: nextConnections,
    default_connection: setAsDefault ? connection.name : config.default_connection ?? connection.name
  };
}

export async function saveConfig(configPath: string, config: ServerConfig): Promise<void> {
  const absolutePath = resolve(configPath);
  await writeFile(absolutePath, stringify(config), "utf8");
}

export async function savePasswordEnvFile(configPath: string, envVarName: string, password: string): Promise<void> {
  const envPath = resolve(dirname(configPath), ".env");
  let entries = new Map<string, string>();
  try {
    entries = parseEnvFile(await readFile(envPath, "utf8"));
  } catch {
    // Optional env file.
  }

  entries.set(envVarName, password);
  const content = [...entries.entries()].map(([key, value]) => `${key}=${value}`).join("\n");
  await writeFile(envPath, `${content}\n`, "utf8");
}
