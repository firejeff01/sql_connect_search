import { AbstractDriver } from "./AbstractDriver.ts";

export class OracleDriver extends AbstractDriver {
  constructor() {
    super("oracledb");
  }
}
