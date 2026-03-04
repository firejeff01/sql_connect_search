import type { ConnectionConfig } from "../types/connection.ts";
import type { CredentialConfig } from "../config/IConfig.ts";
import { AESCredentialProvider } from "./AESCredentialProvider.ts";
import { EnvCredentialProvider } from "./EnvCredentialProvider.ts";
import type { CredentialResolutionResult, ICredentialProvider } from "./ICredentialProvider.ts";
import { KeychainCredentialProvider } from "./KeychainCredentialProvider.ts";
import { VaultCredentialProvider } from "./VaultCredentialProvider.ts";

export class CredentialResolver {
  private readonly providers: Map<string, ICredentialProvider>;

  constructor(customProviders: Record<string, ICredentialProvider> = {}) {
    this.providers = new Map<string, ICredentialProvider>([
      ["env", new EnvCredentialProvider()],
      ["keychain", new KeychainCredentialProvider()],
      ["vault", new VaultCredentialProvider()],
      ["aes", new AESCredentialProvider()],
      ...Object.entries(customProviders)
    ]);
  }

  private getProvider(providerName?: string): ICredentialProvider {
    const name = providerName ?? "env";
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Credential provider '${name}' is not registered`);
    }
    return provider;
  }

  async resolve(reference: string, credentialConfig?: CredentialConfig, connectionName?: string): Promise<CredentialResolutionResult> {
    const provider = this.getProvider(credentialConfig?.provider);
    return provider.resolve(reference, {
      config: credentialConfig,
      connectionName
    });
  }

  async resolveConnections(connections: ConnectionConfig[], credentialConfig?: CredentialConfig): Promise<ConnectionConfig[]> {
    const resolved: ConnectionConfig[] = [];

    for (const connection of connections) {
      if (connection.passwordRef) {
        const result = await this.resolve(connection.passwordRef, credentialConfig, connection.name);
        if (!result.resolved || !result.password) {
          throw new Error(result.error ?? `Failed to resolve credentials for '${connection.name}'`);
        }
        resolved.push({ ...connection, password: result.password });
        continue;
      }

      if (connection.password && /^\$\{[A-Z0-9_]+\}$/.test(connection.password)) {
        const result = await this.resolve(connection.password, credentialConfig, connection.name);
        if (!result.resolved || !result.password) {
          throw new Error(result.error ?? `Failed to resolve credentials for '${connection.name}'`);
        }
        resolved.push({ ...connection, password: result.password });
        continue;
      }

      resolved.push(connection);
    }

    return resolved;
  }
}
