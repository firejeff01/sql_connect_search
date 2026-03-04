import type { ISQLValidator, SQLValidationResult } from "./ISQLValidator.ts";

const ALLOWED = new Set(["select", "show", "describe", "explain"]);
const FORBIDDEN = new Set(["insert", "update", "delete", "drop", "alter", "truncate"]);

function detectStatementType(query: string): string | undefined {
  const normalized = query.trim().replace(/^\(+/, "");
  return normalized.split(/\s+/)[0]?.toLowerCase();
}

export class SQLValidator implements ISQLValidator {
  validate(query: string): SQLValidationResult {
    const trimmed = query.trim();
    if (!trimmed) {
      return { valid: false, error: "Query is required" };
    }

    const semicolons = [...trimmed.matchAll(/;/g)].length;
    if (semicolons > 1 || (semicolons === 1 && !trimmed.endsWith(";"))) {
      return { valid: false, error: "Multiple statements are not allowed" };
    }

    const statementType = detectStatementType(trimmed.replace(/;$/, ""));
    if (!statementType) {
      return { valid: false, error: "Unable to determine SQL statement type" };
    }

    if (FORBIDDEN.has(statementType)) {
      return {
        valid: false,
        statementType,
        error: `SQL statement '${statementType}' is not allowed`
      };
    }

    if (!ALLOWED.has(statementType)) {
      return {
        valid: false,
        statementType,
        error: "Only read-only SQL statements are allowed"
      };
    }

    return {
      valid: true,
      statementType
    };
  }
}
