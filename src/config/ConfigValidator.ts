import type { ConnectionConfig } from "../types/connection.ts";
import type { ServerConfig } from "./IConfig.ts";

export class ConfigValidationError extends Error {}

const PASSWORD_REF_PATTERN = /^\$\{[A-Z0-9_]+\}$/;

function validateConnection(connection: ConnectionConfig): void {
  const required = ["name", "type", "host", "port", "database", "username"] as const;
  for (const field of required) {
    if (connection[field] === undefined || connection[field] === null || connection[field] === "") {
      throw new ConfigValidationError(`Connection field '${field}' is required`);
    }
  }

  if (connection.password && !PASSWORD_REF_PATTERN.test(connection.password)) {
    throw new ConfigValidationError(
      "Plaintext password detected in config. Use ${ENV_VAR} syntax or a credential provider.",
    );
  }
}

export class ConfigValidator {
  static validate(config: ServerConfig): ServerConfig {
    if (!Array.isArray(config.connections)) {
      throw new ConfigValidationError("connections must be an array");
    }

    for (const connection of config.connections) {
      validateConnection(connection);
    }

    if (!config.pool) {
      throw new ConfigValidationError("pool config is required");
    }
    if (!config.limits) {
      throw new ConfigValidationError("limits config is required");
    }
    if (!config.audit) {
      throw new ConfigValidationError("audit config is required");
    }

    return config;
  }
}
