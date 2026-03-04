import { AbstractDriver } from "./AbstractDriver.ts";

export class PostgreSQLDriver extends AbstractDriver {
  constructor() {
    super("pg");
  }
}
