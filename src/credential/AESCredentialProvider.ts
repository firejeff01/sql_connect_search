import { createDecipheriv, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { CredentialContext, CredentialResolutionResult, ICredentialProvider } from "./ICredentialProvider.ts";

interface AESRecord {
  iv: string;
  tag: string;
  data: string;
}

export class AESCredentialProvider implements ICredentialProvider {
  async resolve(reference: string, context?: CredentialContext): Promise<CredentialResolutionResult> {
    const envName = context?.config?.aes_key_env ?? "MCP_MASTER_KEY";
    const filePath = context?.config?.aes_file_path;
    const masterKey = process.env[envName];

    if (!masterKey) {
      return {
        resolved: false,
        error: `Master key environment variable ${envName} is not set`
      };
    }

    if (!filePath) {
      return {
        resolved: false,
        error: "AES credential file path is not configured"
      };
    }

    const raw = await readFile(filePath, "utf8");
    const records = JSON.parse(raw) as Record<string, AESRecord>;
    const record = records[reference];
    if (!record) {
      return {
        resolved: false,
        error: `Encrypted password for '${reference}' is not found`
      };
    }

    const key = createHash("sha256").update(masterKey).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(record.iv, "base64"));
    decipher.setAuthTag(Buffer.from(record.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(record.data, "base64")),
      decipher.final()
    ]).toString("utf8");

    return {
      resolved: true,
      password: decrypted
    };
  }
}
