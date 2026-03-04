import type { DatabaseType } from "../../types/connection.ts";
import type { IDriverAdapter } from "./IDriverAdapter.ts";
import { MongoDBDriver } from "./MongoDBDriver.ts";
import { MSSQLDriver } from "./MSSQLDriver.ts";
import { MySQLDriver } from "./MySQLDriver.ts";
import { OracleDriver } from "./OracleDriver.ts";
import { PostgreSQLDriver } from "./PostgreSQLDriver.ts";

export class DriverFactory {
  static createDriver(type: DatabaseType): IDriverAdapter {
    switch (type) {
      case "mssql":
        return new MSSQLDriver();
      case "mysql2":
        return new MySQLDriver();
      case "pg":
        return new PostgreSQLDriver();
      case "oracledb":
        return new OracleDriver();
      case "mongodb":
        return new MongoDBDriver();
      default:
        throw new Error(`Unsupported driver type '${type}'`);
    }
  }
}
