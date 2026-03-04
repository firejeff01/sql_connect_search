import type { CorsConfig } from "../config/IConfig.ts";

export interface CorsResponseLike {
  statusCode: number;
  headers: Record<string, string>;
}

export class CorsHandler {
  private readonly config?: CorsConfig;

  constructor(config?: CorsConfig) {
    this.config = config;
  }

  apply(method: string): CorsResponseLike | undefined {
    if (!this.config?.enabled) {
      return undefined;
    }

    const headers = {
      "Access-Control-Allow-Origin": this.config.allowed_origins.join(","),
      "Access-Control-Allow-Methods": this.config.allowed_methods.join(","),
      "Access-Control-Allow-Headers": this.config.allowed_headers.join(",")
    };

    if (method === "OPTIONS") {
      return { statusCode: 204, headers };
    }

    return { statusCode: 200, headers };
  }
}
