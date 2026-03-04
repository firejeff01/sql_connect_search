import type { IDriverAdapter } from "../database/drivers/IDriverAdapter.ts";
import type { DiscoverSchemaInput, SchemaOverview, TableDescription } from "../types/schema.ts";

export interface ISchemaService {
  describeTable(driver: IDriverAdapter, tableName: string): Promise<TableDescription>;
  discover(driver: IDriverAdapter, input: DiscoverSchemaInput): Promise<SchemaOverview>;
}
