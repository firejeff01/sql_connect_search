import type { AuditConfig } from "../config/IConfig.ts";
import type { AuditLogEntry } from "../types/audit.ts";
import type { IAuditLogger } from "./IAuditLogger.ts";

export class AuditLogger implements IAuditLogger {
  private readonly entries: AuditLogEntry[] = [];
  private readonly config: AuditConfig;
  private readonly output: NodeJS.WritableStream;

  constructor(config: AuditConfig, output: NodeJS.WritableStream = process.stderr) {
    this.config = config;
    this.output = output;
  }

  log(entry: AuditLogEntry): void {
    if (!this.config.enabled) {
      return;
    }
    this.entries.push(entry);
    this.output.write(`${JSON.stringify(entry)}\n`);
  }

  getEntries(): AuditLogEntry[] {
    return [...this.entries];
  }
}
