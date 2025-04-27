import { DelayStrategy, HookSettings } from './types';

/**
 * Handles retry logic and delay strategies for failed API calls
 */
export class RetryManager {
  private defaultMaxDelay = 60000; // Default max delay of 1 minute
  private defaultMaxRetries = 4;

  /**
   * Default exponential backoff strategy with full jitter
   */
  private defaultDelayStrategy: DelayStrategy = {
    calculate: (attempt: number, response?: any) => {
      // Check for Retry-After header
      const retryAfter = this.getRetryAfterValue(response);
      if (retryAfter) return retryAfter;
      
      // Exponential backoff with full jitter
      const baseDelay = 1000; // 1 second
      const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
      return Math.floor(Math.random() * exponentialDelay);
    },
  };

  /**
   * Calculate and wait for appropriate delay time before retry
   */
  public async calculateAndDelay(params: {
    attempt: number;
    response?: any;
    hook: HookSettings;
  }): Promise<void> {
    const { attempt, response, hook } = params;
    const delayStrategy = hook.delayStrategy || this.defaultDelayStrategy;
    const maxDelay = hook.maxDelay || this.defaultMaxDelay;

    const calculatedDelay = delayStrategy.calculate(attempt, response);
    const finalDelay = Math.min(calculatedDelay, maxDelay);

    console.log(`🔄 Waiting for ${finalDelay / 1000} seconds before retrying.`);
    await new Promise(resolve => setTimeout(resolve, finalDelay));
  }

  /**
   * Extract retry-after value from response
   */
  private getRetryAfterValue(response?: any): number | null {
    if (!response?.headers?.get) return null;
    
    const retryAfter = response.headers.get('Retry-After');
    if (!retryAfter) return null;
    
    // Handle numeric retry-after
    const parsedDelay = parseInt(retryAfter, 10);
    if (!isNaN(parsedDelay)) {
      return parsedDelay * 1000;
    }
    
    // Handle date retry-after
    const date = new Date(retryAfter).getTime();
    const now = Date.now();
    if (date > now) {
      return date - now;
    }
    
    return null;
  }
  
  /**
   * Get the default maximum number of retries
   */
  public getDefaultMaxRetries(): number {
    return this.defaultMaxRetries;
  }
  
  /**
   * Set the default maximum number of retries
   */
  public setDefaultMaxRetries(maxRetries: number): void {
    this.defaultMaxRetries = maxRetries;
  }
  
  /**
   * Set the default maximum delay between retries
   */
  public setDefaultMaxDelay(maxDelay: number): void {
    this.defaultMaxDelay = maxDelay;
  }
} 