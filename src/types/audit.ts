export interface AuditLogEntry {
  timestamp: string;
  connection_name: string;
  query: string;
  row_count: number;
  execution_time: string;
  client: string;
}
