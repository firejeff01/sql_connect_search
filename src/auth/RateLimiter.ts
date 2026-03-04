import type { RateLimitConfig } from "../config/IConfig.ts";

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export class RateLimiter {
  private readonly keyBuckets = new Map<string, Bucket>();
  private readonly ipBuckets = new Map<string, Bucket>();
  private readonly config?: RateLimitConfig;

  constructor(config?: RateLimitConfig) {
    this.config = config;
  }

  private checkBucket(store: Map<string, Bucket>, key: string, max: number, windowMs: number): RateLimitResult {
    const current = store.get(key);
    const now = Date.now();
    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true };
    }

    if (current.count >= max) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000)
      };
    }

    current.count += 1;
    return { allowed: true };
  }

  checkLimit(apiKey?: string, clientIp?: string): RateLimitResult {
    if (apiKey && this.config?.per_key) {
      const result = this.checkBucket(
        this.keyBuckets,
        apiKey,
        this.config.per_key.max,
        this.config.per_key.window_ms
      );
      if (!result.allowed) {
        return result;
      }
    }

    if (clientIp && this.config?.per_ip) {
      return this.checkBucket(
        this.ipBuckets,
        clientIp,
        this.config.per_ip.max,
        this.config.per_ip.window_ms
      );
    }

    return { allowed: true };
  }
}
