import type { LimitsConfig } from "../config/IConfig.ts";
import type { IDriverAdapter } from "../database/drivers/IDriverAdapter.ts";
import type { DiscoverSchemaInput, SchemaOverview, TableDescription } from "../types/schema.ts";
import type { ISchemaService } from "./ISchemaService.ts";

export class SchemaService implements ISchemaService {
  private readonly limits: LimitsConfig;

  constructor(limits: LimitsConfig) {
    this.limits = limits;
  }

  async describeTable(driver: IDriverAdapter, tableName: string): Promise<TableDescription> {
    if (!driver.describeTable) {
      throw new Error(`Driver '${driver.getType()}' does not support table description`);
    }
    return driver.describeTable(tableName);
  }

  async discover(driver: IDriverAdapter, input: DiscoverSchemaInput): Promise<SchemaOverview> {
    if (!driver.discoverSchema) {
      throw new Error(`Driver '${driver.getType()}' does not support schema discovery`);
    }

    const overview = await driver.discoverSchema({
      includePatterns: input.include_patterns,
      excludePatterns: input.exclude_patterns,
      depth: input.depth
    });

    const maxBytes = this.limits.result_size * 1024 * 1024;
    let tables = overview.tables;
    let truncated = overview.truncated;

    while (tables.length > 0) {
      const size = Buffer.byteLength(JSON.stringify({ ...overview, tables, truncated }));
      if (size <= maxBytes) {
        break;
      }
      tables = tables.slice(0, -1);
      truncated = true;
    }

    return {
      ...overview,
      tables,
      truncated,
      message: truncated ? "Schema output was truncated. Use include_patterns to narrow the scope." : undefined
    };
  }
}
