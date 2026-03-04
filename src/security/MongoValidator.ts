import type { IMongoValidator, MongoValidationResult } from "./IMongoValidator.ts";

interface MongoValidatorOptions {
  restrictLookup?: boolean;
  restrictGraphLookup?: boolean;
}

const ALLOWED = new Set([
  "find",
  "aggregate",
  "countDocuments",
  "distinct",
  "listCollections",
  "listIndexes",
  "explain"
]);

const WRITE_DENIED = new Set([
  "insertOne",
  "insertMany",
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "bulkWrite",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace"
]);

const ADMIN_DENIED = new Set([
  "drop",
  "dropDatabase",
  "createCollection",
  "createIndex",
  "dropIndex",
  "renameCollection"
]);

const PIPELINE_DENIED = new Set(["$out", "$merge"]);

export class MongoValidator implements IMongoValidator {
  private readonly options: MongoValidatorOptions;

  constructor(options: MongoValidatorOptions = {}) {
    this.options = options;
  }

  validateOperation(operation: string): MongoValidationResult {
    if (ALLOWED.has(operation)) {
      return { valid: true, operation };
    }

    if (WRITE_DENIED.has(operation)) {
      return { valid: false, operation, error: `Write operation ${operation} is not allowed` };
    }

    if (ADMIN_DENIED.has(operation)) {
      return { valid: false, operation, error: `Administrative operation ${operation} is not allowed` };
    }

    return { valid: false, operation, error: `Operation ${operation} is not allowed` };
  }

  validatePipeline(pipeline: Record<string, unknown>[] = []): MongoValidationResult {
    for (const stage of pipeline) {
      for (const key of Object.keys(stage)) {
        if (PIPELINE_DENIED.has(key)) {
          return {
            valid: false,
            error: `Pipeline stage ${key} is not allowed: writes data to output collection`
          };
        }
        if (key === "$lookup" && this.options.restrictLookup) {
          return { valid: false, error: "$lookup is restricted by server policy" };
        }
        if (key === "$graphLookup" && this.options.restrictGraphLookup) {
          return { valid: false, error: "$graphLookup is restricted by server policy" };
        }
      }
    }

    return { valid: true };
  }
}
