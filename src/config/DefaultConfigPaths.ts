import { access, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const ENV_CONFIG_PATH = "SQL_CONNECT_SEARCH_CONFIG";

export function getDefaultConfigPath(): string {
  const explicitPath = process.env[ENV_CONFIG_PATH]?.trim();
  if (explicitPath) {
    return resolve(explicitPath);
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA?.trim();
    if (appData) {
      return resolve(appData, "sql-connect-search", "config.yaml");
    }
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME?.trim();
  if (xdgConfigHome) {
    return resolve(xdgConfigHome, "sql-connect-search", "config.yaml");
  }

  return resolve(homedir(), ".config", "sql-connect-search", "config.yaml");
}

export async function configFileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function createStarterConfigYaml(): string {
  return `# Starter config created by sql-connect-search-mcp init
# Update the connection fields for your own database.
# The password stays in the environment, not in this file.

connections:
  - name: default-mysql
    type: mysql2
    host: 127.0.0.1
    port: 3306
    database: app
    username: root
    passwordRef: \${MYSQL_LIVE_PASSWORD}
    aliases:
      - default

pool:
  max: 10
  min: 1
  idleTimeout: 30000

limits:
  max_rows: 1000
  timeout: 30
  result_size: 5
  max_execution_time: 60

audit:
  enabled: true

credential:
  provider: env

default_connection: default-mysql
`;
}

export async function writeStarterConfig(configPath: string, force = false): Promise<"created" | "overwritten"> {
  const absolutePath = resolve(configPath);
  const exists = await configFileExists(absolutePath);
  if (exists && !force) {
    throw new Error(`Config file already exists at '${absolutePath}'. Use --force to overwrite it.`);
  }

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, createStarterConfigYaml(), "utf8");
  return exists ? "overwritten" : "created";
}
