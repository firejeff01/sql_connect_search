export interface MongoValidationResult {
  valid: boolean;
  operation?: string;
  error?: string;
}

export interface IMongoValidator {
  validateOperation(operation: string): MongoValidationResult;
  validatePipeline(pipeline?: Record<string, unknown>[]): MongoValidationResult;
}
