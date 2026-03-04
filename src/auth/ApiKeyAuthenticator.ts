import type { AuthRequestLike, AuthResult, IAuthenticator } from "./IAuthenticator.ts";

export class ApiKeyAuthenticator implements IAuthenticator {
  private readonly apiKeys: string[];

  constructor(apiKeys: string[]) {
    this.apiKeys = apiKeys;
  }

  authenticate(request: AuthRequestLike): AuthResult {
    const rawHeader = request.headers.authorization;
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!header) {
      return {
        authenticated: false,
        statusCode: 401,
        body: { error: "Authorization header is required" }
      };
    }

    if (!header.startsWith("Bearer ")) {
      return {
        authenticated: false,
        statusCode: 401,
        body: { error: "Bearer token required" }
      };
    }

    const token = header.slice("Bearer ".length);
    if (!this.apiKeys.includes(token)) {
      return {
        authenticated: false,
        statusCode: 401,
        body: { error: "Invalid API key" }
      };
    }

    return {
      authenticated: true,
      token
    };
  }
}
