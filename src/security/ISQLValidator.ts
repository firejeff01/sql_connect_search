export interface SQLValidationResult {
  valid: boolean;
  statementType?: string;
  error?: string;
}

export interface ISQLValidator {
  validate(query: string): SQLValidationResult;
}
