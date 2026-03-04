import type { PoolConfig } from "../../types/connection.ts";
import type { IDriverAdapter } from "../drivers/IDriverAdapter.ts";

export class ConnectionPool {
  private idleTimer?: NodeJS.Timeout;
  private readonly driver: IDriverAdapter;
  private readonly poolConfig: PoolConfig;
  private readonly onDestroy?: () => void;

  constructor(driver: IDriverAdapter, poolConfig: PoolConfig, onDestroy?: () => void) {
    this.driver = driver;
    this.poolConfig = poolConfig;
    this.onDestroy = onDestroy;
  }

  async initialize(): Promise<void> {
    this.bumpIdleTimer();
  }

  getDriver(): IDriverAdapter {
    this.bumpIdleTimer();
    return this.driver;
  }

  getConfig(): PoolConfig {
    return this.poolConfig;
  }

  bumpIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      void this.destroy();
    }, this.poolConfig.idleTimeout);
    this.idleTimer.unref?.();
  }

  async destroy(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
    await this.driver.disconnect();
    this.onDestroy?.();
  }
}
