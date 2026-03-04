import type { CredentialContext, CredentialResolutionResult, ICredentialProvider } from "./ICredentialProvider.ts";

export class KeychainCredentialProvider implements ICredentialProvider {
  async resolve(reference: string, _context?: CredentialContext): Promise<CredentialResolutionResult> {
    return {
      resolved: false,
      error: `Password for '${reference}' not found in OS keychain`
    };
  }
}
