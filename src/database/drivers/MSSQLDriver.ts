import { AbstractDriver } from "./AbstractDriver.ts";

export class MSSQLDriver extends AbstractDriver {
  constructor() {
    super("mssql");
  }
}
