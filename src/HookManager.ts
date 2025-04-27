import { HookSettings, StatusCode } from './types';

/**
 * Manages hooks for different status codes and their processing
 */
export class HookManager {
  private hooks: Record<StatusCode, HookSettings> = {};
  private hookPromises: Record<string, Promise<object>> = {};

  /**
   * Set hooks for different status codes
   */
  public setHooks(hooks: Record<StatusCode, HookSettings>): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  /**
   * Get a hook for a specific status code
   */
  public getHook(status: StatusCode): HookSettings | undefined {
    return this.hooks[status];
  }

  /**
   * Process a hook for a specific status code
   */
  public async processHook(
    accountId: string,
    status: StatusCode,
    error: any
  ): Promise<Record<string, any> | null> {
    const hook = this.hooks[status];
    if (!hook || !hook.handler) return null;
    
    const hookKey = `${accountId || 'default'}-${status}`;
    
    try {
      // Handle waiting for existing hook call if needed
      if (hook.preventConcurrentCalls) {
        if (!this.hookPromises[hookKey]) {
          this.hookPromises[hookKey] = Promise.resolve(
            hook.handler(accountId, error.response) || {}
          );
        }
        
        const result = await this.hookPromises[hookKey];
        delete this.hookPromises[hookKey];
        return result;
      } 
      
      // Otherwise just call the hook directly
      return await hook.handler(accountId, error.response) || {};
    } 
    catch (hookError) {
      console.error(`Hook handler failed for status ${status}:`, hookError);
      
      if (hook.onHandlerError) {
        await hook.onHandlerError(accountId, hookError);
      }
      
      throw hookError;
    }
  }

  /**
   * Handle a retry failure with the appropriate hook
   */
  public async handleRetryFailure(accountId: string, status: StatusCode, error: any): Promise<void> {
    const hook = this.hooks[status];
    if (hook?.onMaxRetriesExceeded) {
      await hook.onMaxRetriesExceeded(accountId, error);
    }
  }

  /**
   * Check if a hook exists and should retry for a given status
   */
  public shouldRetry(status: StatusCode): boolean {
    const hook = this.hooks[status];
    return !!hook && !!hook.shouldRetry;
  }
} 