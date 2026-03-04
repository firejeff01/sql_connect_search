export interface DescribeTablesInput {
  connection_name?: string;
  table_name: string;
}

export interface ColumnDetail {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ForeignKeyInfo {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface TableDescription {
  tableName: string;
  columns: ColumnDetail[];
  primaryKey: string[];
  indexes: IndexInfo[];
  foreignKeys?: ForeignKeyInfo[];
  rowEstimate?: number;
}

export interface DiscoverSchemaInput {
  connection_name?: string;
  include_patterns?: string;
  exclude_patterns?: string;
  depth?: number;
}

export interface TableSummary {
  name: string;
  columns: { name: string; type: string }[];
}

export interface RelationshipInfo {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

export interface SchemaOverview {
  database: string;
  tables: TableSummary[];
  relationships?: RelationshipInfo[];
  truncated: boolean;
  message?: string;
}
