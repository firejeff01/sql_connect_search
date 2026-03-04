import type { AuditLogEntry } from "../types/audit.ts";

export interface IAuditLogger {
  log(entry: AuditLogEntry): void;
  getEntries(): AuditLogEntry[];
}
