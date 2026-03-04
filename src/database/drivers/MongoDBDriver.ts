import { AbstractDriver } from "./AbstractDriver.ts";

export class MongoDBDriver extends AbstractDriver {
  constructor() {
    super("mongodb");
  }
}
