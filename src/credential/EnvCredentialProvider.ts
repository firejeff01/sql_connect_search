import type { CredentialContext, CredentialResolutionResult, ICredentialProvider } from "./ICredentialProvider.ts";

function normalizeReference(reference: string): string {
  const match = /^\$\{([A-Z0-9_]+)\}$/.exec(reference);
  return match ? match[1] : reference;
}

export class EnvCredentialProvider implements ICredentialProvider {
  async resolve(reference: string, _context?: CredentialContext): Promise<CredentialResolutionResult> {
    const envName = normalizeReference(reference);
    const value = process.env[envName];
    if (!value) {
      return {
        resolved: false,
        error: `Environment variable ${envName} is not set`
      };
    }

    return {
      resolved: true,
      password: value
    };
  }
}
