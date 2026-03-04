import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SchemaOverview } from "../types/schema.ts";

interface CacheRecord {
  createdAt: number;
  expiresAt: number;
  value: SchemaOverview;
}

export interface SchemaCacheEntry {
  value: SchemaOverview;
  createdAt: number;
  expiresAt: number;
  source: "memory" | "disk";
}

export class SchemaCache {
  private readonly cache = new Map<string, CacheRecord>();
  private readonly ttlMs: number;
  private readonly cacheDir?: string;

  constructor(ttlMs = 10 * 60 * 1000, cacheDir?: string) {
    this.ttlMs = ttlMs;
    this.cacheDir = cacheDir;
  }

  private getFilePath(key: string): string | undefined {
    if (!this.cacheDir) {
      return undefined;
    }

    const hashedKey = createHash("sha1").update(key).digest("hex");
    return join(this.cacheDir, `${hashedKey}.json`);
  }

  async getEntry(key: string): Promise<SchemaCacheEntry | undefined> {
    const record = this.cache.get(key);
    if (!record) {
      const persisted = await this.readPersistedRecord(key);
      if (!persisted) {
        return undefined;
      }
      this.cache.set(key, persisted);
      return {
        value: persisted.value,
        createdAt: persisted.createdAt,
        expiresAt: persisted.expiresAt,
        source: "disk"
      };
    }
    if (record.expiresAt < Date.now()) {
      this.cache.delete(key);
      await this.deletePersistedRecord(key);
      return undefined;
    }
    return {
      value: record.value,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      source: "memory"
    };
  }

  async get(key: string): Promise<SchemaOverview | undefined> {
    const entry = await this.getEntry(key);
    return entry?.value;
  }

  async set(key: string, value: SchemaOverview): Promise<void> {
    const now = Date.now();
    const record = {
      createdAt: now,
      value,
      expiresAt: now + this.ttlMs
    };
    this.cache.set(key, record);
    await this.persistRecord(key, record);
  }

  private async readPersistedRecord(key: string): Promise<CacheRecord | undefined> {
    const filePath = this.getFilePath(key);
    if (!filePath) {
      return undefined;
    }

    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<CacheRecord>;
      const normalized: CacheRecord = {
        createdAt:
          typeof parsed.createdAt === "number"
            ? parsed.createdAt
            : typeof parsed.expiresAt === "number"
              ? parsed.expiresAt - this.ttlMs
              : Date.now(),
        expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : Date.now() + this.ttlMs,
        value: parsed.value as SchemaOverview
      };
      if (!normalized.value) {
        return undefined;
      }
      if (normalized.expiresAt < Date.now()) {
        await this.deletePersistedRecord(key);
        return undefined;
      }
      return normalized;
    } catch {
      return undefined;
    }
  }

  private async persistRecord(key: string, record: CacheRecord): Promise<void> {
    const filePath = this.getFilePath(key);
    if (!filePath) {
      return;
    }

    await mkdir(this.cacheDir!, { recursive: true });
    await writeFile(filePath, JSON.stringify(record), "utf8");
  }

  private async deletePersistedRecord(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    if (!filePath) {
      return;
    }

    await rm(filePath, { force: true });
  }
}
