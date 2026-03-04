import type { CredentialContext, CredentialResolutionResult, ICredentialProvider } from "./ICredentialProvider.ts";

export class VaultCredentialProvider implements ICredentialProvider {
  async resolve(reference: string, context?: CredentialContext): Promise<CredentialResolutionResult> {
    const provider = context?.config?.vault_type ?? "hashicorp";
    return {
      resolved: false,
      error: `Failed to connect to vault service: provider '${provider}' is not configured for '${reference}'`
    };
  }
}
