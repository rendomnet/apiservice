import { ApiCallParams } from './types';

/**
 * Handles caching of API responses
 */
export class CacheManager {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTime = 20000; // Default cache time of 20 seconds

  /**
   * Get data from cache if available and not expired
   */
  public getFromCache(apiCallParams: ApiCallParams): any {
    const requestKey = this.getRequestKey(apiCallParams);
    const currentCacheTime = apiCallParams.cacheTime ?? this.cacheTime;
    const cached = this.cache.get(requestKey);
    
    if (cached && (Date.now() - cached.timestamp < currentCacheTime)) {
      return cached.data;
    }
    
    return null;
  }

  /**
   * Save data to cache
   */
  public saveToCache(apiCallParams: ApiCallParams, data: any): void {
    const requestKey = this.getRequestKey(apiCallParams);
    this.cache.set(requestKey, { 
      data, 
      timestamp: Date.now() 
    });
  }

  /**
   * Generate a unique key for caching based on request parameters
   */
  private getRequestKey(apiCallParams: ApiCallParams): string {
    const { accountId, method, route, base, queryParams, body, data } = apiCallParams;
    return JSON.stringify({
      accountId,
      method,
      route,
      base,
      queryParams,
      body: body || data,
    });
  }

  /**
   * Set the default cache time in milliseconds
   */
  public setCacheTime(milliseconds: number): void {
    this.cacheTime = milliseconds;
  }

  /**
   * Clear the entire cache
   */
  public clearCache(): void {
    this.cache.clear();
  }
} 