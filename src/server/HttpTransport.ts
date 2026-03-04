import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { HttpConfig } from "../config/IConfig.ts";
import { ApiKeyAuthenticator } from "../auth/ApiKeyAuthenticator.ts";
import { CorsHandler } from "../auth/CorsHandler.ts";
import { JwtAuthenticator } from "../auth/JwtAuthenticator.ts";
import { RateLimiter } from "../auth/RateLimiter.ts";
import { createJsonRpcError, createJsonRpcErrorFromUnknown, type JsonRpcHandlerResult, type JsonRpcRequest } from "./protocol.ts";

export class HttpTransport {
  readonly type = "http";
  readonly bindAddress: string;
  readonly port: number;
  readonly corsHandler: CorsHandler;
  readonly rateLimiter: RateLimiter;
  readonly authenticator: ApiKeyAuthenticator | JwtAuthenticator;
  private readonly config: HttpConfig;
  private server?: Server;

  constructor(config: HttpConfig) {
    this.config = config;
    this.port = config.port;
    this.bindAddress = config.bind ?? "127.0.0.1";
    this.corsHandler = new CorsHandler(config.cors);
    this.rateLimiter = new RateLimiter(config.rate_limit);
    this.authenticator =
      config.auth_scheme === "jwt"
        ? new JwtAuthenticator()
        : new ApiKeyAuthenticator(config.api_keys);
  }

  private async readJsonBody(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks).toString("utf8");
    return body ? JSON.parse(body) : {};
  }

  private writeJson(response: ServerResponse, statusCode: number, body: unknown, headers: Record<string, string> = {}): void {
    response.writeHead(statusCode, {
      "Content-Type": "application/json",
      ...headers
    });
    response.end(JSON.stringify(body));
  }

  async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    handler: (payload: JsonRpcRequest) => Promise<JsonRpcHandlerResult>
  ): Promise<void> {
    const cors = this.corsHandler.apply(request.method ?? "GET");
    if (cors?.headers) {
      for (const [key, value] of Object.entries(cors.headers)) {
        response.setHeader(key, value);
      }
    }

    if (request.method === "OPTIONS") {
      response.writeHead(cors?.statusCode ?? 204);
      response.end();
      return;
    }

    if (request.url === "/health" && request.method === "GET") {
      this.writeJson(response, 200, { ok: true, status: "running", transport: "http" });
      return;
    }

    if (request.url !== "/mcp" || request.method !== "POST") {
      this.writeJson(response, 404, createJsonRpcError(null, -32601, "Not found", {
        category: "not_found",
        retryable: false,
        source: "transport"
      }));
      return;
    }

    const auth = this.authenticator.authenticate({
      headers: {
        authorization: request.headers.authorization
      }
    });
    if (!auth.authenticated) {
      this.writeJson(
        response,
        auth.statusCode ?? 401,
        auth.body ??
          createJsonRpcError(null, -32001, "Unauthorized", {
            category: "unauthorized",
            retryable: false,
            source: "transport"
          })
      );
      return;
    }

    const forwardedFor = request.headers["x-forwarded-for"];
    const clientIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor ?? request.socket.remoteAddress ?? "unknown";
    const rateResult = this.rateLimiter.checkLimit(auth.token, clientIp);
    if (!rateResult.allowed) {
      this.writeJson(
        response,
        429,
        createJsonRpcError(null, -32029, "Rate limit exceeded", {
          category: "rate_limited",
          retryable: true,
          source: "transport"
        }),
        rateResult.retryAfterSeconds ? { "Retry-After": String(rateResult.retryAfterSeconds) } : {}
      );
      return;
    }

    try {
      const payload = (await this.readJsonBody(request)) as JsonRpcRequest;
      const result = await handler(payload);
      if (!result) {
        response.writeHead(202);
        response.end();
        return;
      }
      this.writeJson(response, "error" in result ? 400 : 200, result);
    } catch (error) {
      this.writeJson(response, 400, createJsonRpcErrorFromUnknown(null, error, "transport"));
    }
  }

  async start(
    handler: (payload: JsonRpcRequest) => Promise<JsonRpcHandlerResult>
  ): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = createServer((request, response) => {
      void this.handleRequest(request, response, handler);
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(this.port, this.bindAddress, () => {
        this.server!.off("error", reject);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    this.server = undefined;
  }
}
