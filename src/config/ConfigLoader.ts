import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse } from "yaml";
import type { ServerConfig } from "./IConfig.ts";
import { ConfigValidator } from "./ConfigValidator.ts";
import { CredentialResolver } from "../credential/CredentialResolver.ts";

function parseDotenv(input: string): void {
  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index < 0) {
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseConfigDocument(raw: string): ServerConfig {
  return parse(raw) as ServerConfig;
}

export class ConfigLoader {
  private readonly credentialResolver: CredentialResolver;

  constructor(credentialResolver = new CredentialResolver()) {
    this.credentialResolver = credentialResolver;
  }

  async loadEnv(cwd: string): Promise<void> {
    const envPath = resolve(cwd, ".env");
    try {
      const content = await readFile(envPath, "utf8");
      parseDotenv(content);
    } catch {
      // Optional .env file.
    }
  }

  async loadConfig(configPath: string): Promise<ServerConfig> {
    const absolutePath = resolve(configPath);
    await this.loadEnv(dirname(absolutePath));
    const raw = await readFile(absolutePath, "utf8");
    const parsed = parseConfigDocument(raw);
    const validated = ConfigValidator.validate(parsed);
    const resolvedConnections = await this.credentialResolver.resolveConnections(
      validated.connections,
      validated.credential
    );

    return {
      ...validated,
      connections: resolvedConnections
    };
  }
}
