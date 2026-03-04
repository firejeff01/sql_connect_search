import type { LimitsConfig } from "../config/IConfig.ts";
import type { QueryResult } from "../database/drivers/IDriverAdapter.ts";

export interface AppliedQueryLimits {
  limit: number;
  timeoutMs: number;
  maxExecutionTimeMs: number;
}

export class QueryPolicy {
  static clampLimits(
    requested: { limit?: number; timeout_ms?: number },
    limits: LimitsConfig
  ): AppliedQueryLimits {
    return {
      limit: Math.min(requested.limit ?? limits.max_rows, limits.max_rows),
      timeoutMs: Math.min(requested.timeout_ms ?? limits.timeout * 1000, limits.timeout * 1000),
      maxExecutionTimeMs: limits.max_execution_time * 1000
    };
  }

  static applyResultLimits(result: QueryResult, limits: LimitsConfig): QueryResult {
    let rows = result.rows;
    let truncated = result.truncated;

    if (rows.length > limits.max_rows) {
      rows = rows.slice(0, limits.max_rows);
      truncated = true;
    }

    const maxBytes = limits.result_size * 1024 * 1024;
    while (rows.length > 0) {
      const size = Buffer.byteLength(
        JSON.stringify({
          ...result,
          rows,
          rowCount: rows.length,
          truncated
        })
      );
      if (size <= maxBytes) {
        break;
      }
      rows = rows.slice(0, -1);
      truncated = true;
    }

    return {
      ...result,
      rows,
      rowCount: rows.length,
      truncated
    };
  }
}
