import type { CredentialConfig } from "../config/IConfig.ts";

export interface CredentialResolutionResult {
  resolved: boolean;
  password?: string;
  error?: string;
}

export interface CredentialContext {
  config?: CredentialConfig;
  connectionName?: string;
}

export interface ICredentialProvider {
  resolve(reference: string, context?: CredentialContext): Promise<CredentialResolutionResult>;
}
