import { 
  TokenService,
  ApiCallParams,
  HookSettings,
  StatusCode,
  Token
} from './types';
import {
  CacheManager,
  RetryManager,
  HookManager,
  HttpClient,
  AccountManager
} from './components';

/**
 * ApiService - Core API service for making authenticated API calls
 * with caching, retry, and hook support.
 */
class ApiService {
  public provider: string; // Service provider name
  private tokenService: TokenService;
  
  // Component managers
  private cacheManager: CacheManager;
  private retryManager: RetryManager;
  private hookManager: HookManager;
  private httpClient: HttpClient;
  private accountManager: AccountManager;
  
  // Default max attempts for API calls
  private maxAttempts = 10;

  constructor() {
    this.provider = '';
    this.tokenService = {} as TokenService;
    
    // Initialize component managers
    this.cacheManager = new CacheManager();
    this.retryManager = new RetryManager();
    this.hookManager = new HookManager();
    this.httpClient = new HttpClient();
    this.accountManager = new AccountManager();
  }

  /**
   * Setup the API service
   */
  public setup({
    provider,
    tokenService,
    hooks,
    cacheTime,
  }: {
    provider: string;
    tokenService: TokenService;
    hooks?: Record<StatusCode, HookSettings>;
    cacheTime: number;
  }) {
    this.provider = provider;
    this.tokenService = tokenService;
    
    if (hooks) {
      this.hookManager.setHooks(hooks);
    }
    
    if (typeof cacheTime !== 'undefined') {
      this.cacheManager.setCacheTime(cacheTime);
    }
  }
  
  /**
   * Set the maximum number of retry attempts
   */
  public setMaxAttempts(attempts: number): void {
    this.maxAttempts = attempts;
  }

  /**
   * Update account data
   */
  public updateAccountData(accountId: string, data: Partial<Record<string, any>>): void {
    this.accountManager.updateAccountData(accountId, data);
  }

  /**
   * Main API call method
   */
  public async makeApiCall(apiCallParams: ApiCallParams): Promise<any> {
    console.log('🔄 makeApiCall', this.provider, apiCallParams.accountId);
    
    // Check cache first
    const cachedData = this.cacheManager.getFromCache(apiCallParams);
    if (cachedData) return cachedData;

    // Make the API call with retry capability
    const result = await this.makeRequestWithRetry(apiCallParams);
    
    // Cache the result
    this.cacheManager.saveToCache(apiCallParams, result);
    
    return result;
  }

  /**
   * Make a request with retry capability
   */
  private async makeRequestWithRetry(apiCallParams: ApiCallParams): Promise<any> {
    const { accountId } = apiCallParams;
    let attempts = 0;
    const statusRetries: Record<StatusCode, number> = {};
    
    // Copy the params to avoid mutation issues
    let currentParams = { ...apiCallParams };

    // Main retry loop
    while (attempts < this.maxAttempts) {
      attempts++;
      
      try {
        // Get authentication token if needed
        const authToken: Token | Record<string, any> = apiCallParams.requireAuth !== false
          ? await this.tokenService.get(accountId)
          : {};
          
        // Verify we have authentication if required
        if (apiCallParams.requireAuth !== false && !apiCallParams.accessToken && !authToken.access_token) {
          throw new Error(`${this.provider} credentials not found for account ID ${accountId}`);
        }
        
        // Make the actual API call
        const response = await this.httpClient.makeRequest(currentParams, authToken);
        
        // Success - update account status and return result
        this.accountManager.setLastRequestFailed(accountId, false);
        return response;
      } 
      catch (error: any) {
        const status = error?.status;
        
        // If no hook exists for this error, or we shouldn't retry, throw
        if (!this.hookManager.shouldRetry(status)) {
          throw error;
        }
        
        // Track retries for this status code
        statusRetries[status] = (statusRetries[status] || 0) + 1;
        const activeHook = this.hookManager.getHook(status);
        const maxRetries = activeHook?.maxRetries ?? this.retryManager.getDefaultMaxRetries();
        
        // Check if we've exceeded retries for this status
        if (statusRetries[status] > maxRetries) {
          await this.hookManager.handleRetryFailure(accountId, status, error);
          this.accountManager.setLastRequestFailed(accountId, true);
          throw error;
        }
        
        // Process the hook to get updated params
        try {
          const hookResult = await this.hookManager.processHook(accountId, status, error);
          if (hookResult) {
            currentParams = { ...currentParams, ...hookResult };
          }
        } 
        catch (hookError) {
          this.accountManager.setLastRequestFailed(accountId, true);
          throw hookError;
        }
        
        // Wait before retrying if needed
        if (activeHook?.useRetryDelay) {
          await this.retryManager.calculateAndDelay({
            attempt: statusRetries[status],
            response: error.response,
            hook: activeHook,
          });
        }
      }
    }
    
    // If we've reached here, we've exceeded our maximum attempts
    this.accountManager.setLastRequestFailed(accountId, true);
    throw new Error(`Exceeded maximum attempts (${this.maxAttempts}) for API call to ${accountId}`);
  }

  /**
   * Set the cache time in milliseconds
   */
  public setCacheTime(milliseconds: number): void {
    this.cacheManager.setCacheTime(milliseconds);
  }

  /**
   * Clear the cache
   */
  public clearCache(): void {
    this.cacheManager.clearCache();
  }
}

export default ApiService;
