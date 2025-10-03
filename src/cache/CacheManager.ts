import { CacheItem } from '../types';

export class CacheManager {
  private cache: Map<string, CacheItem> = new Map();
  private enabled: boolean;
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  set(key: string, data: any, ttl?: number): void {
    if (!this.enabled) return;

    this.cache.set(key, {
      key,
      data,
      timestamp: Date.now()
    });

    // Auto-cleanup after TTL
    setTimeout(() => {
      this.delete(key);
    }, ttl || this.defaultTTL);
  }

  get(key: string): any | null {
    if (!this.enabled) return null;

    const item = this.cache.get(key);
    if (!item) return null;

    const isExpired = Date.now() - item.timestamp > this.defaultTTL;
    if (isExpired) {
      this.delete(key);
      return null;
    }

    return item.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
    this.clear();
  }
}