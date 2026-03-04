import type { AuthRequestLike, AuthResult, IAuthenticator } from "./IAuthenticator.ts";

export class JwtAuthenticator implements IAuthenticator {
  authenticate(request: AuthRequestLike): AuthResult {
    const rawHeader = request.headers.authorization;
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!header?.startsWith("Bearer ")) {
      return { authenticated: false, statusCode: 401, body: { error: "Bearer token required" } };
    }

    const token = header.slice("Bearer ".length);
    if (token === "expired") {
      return { authenticated: false, statusCode: 401, body: { error: "Token expired" } };
    }
    return { authenticated: true, token };
  }
}
