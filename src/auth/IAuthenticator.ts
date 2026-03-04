export interface AuthRequestLike {
  headers: Record<string, string | string[] | undefined>;
}

export interface AuthResult {
  authenticated: boolean;
  statusCode?: number;
  body?: { error: string };
  token?: string;
}

export interface IAuthenticator {
  authenticate(request: AuthRequestLike): AuthResult;
}
