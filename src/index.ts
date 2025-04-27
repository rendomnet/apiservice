import { 
  TokenService,
  ApiCallParams,
  HookSettings,
  StatusCode,
  Token,
  OAuthToken
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
    hooks = {},
    cacheTime,
  }: {
    provider: string;
    tokenService: TokenService;
    hooks?: Record<StatusCode, HookSettings | null>;
    cacheTime: number;
  }) {
    this.provider = provider;
    this.tokenService = tokenService;
    
    // Create a copy of hooks to avoid modifying the input
    const finalHooks: Record<StatusCode, HookSettings> = {};
    
    // Apply default 401 handler if:
    // 1. No 401 hook is explicitly defined (or is explicitly null)
    // 2. TokenService has a refresh method
    if (hooks[401] === undefined && typeof this.tokenService.refresh === 'function') {
      finalHooks[401] = this.createDefaultTokenRefreshHandler();
    }
    
    // Add user-defined hooks (skipping null/undefined values)
    for (const [statusCode, hook] of Object.entries(hooks)) {
      if (hook) {
        finalHooks[statusCode] = hook;
      }
    }
    
    // Set the hooks if we have any
    if (Object.keys(finalHooks).length > 0) {
      this.hookManager.setHooks(finalHooks);
    }
    
    if (typeof cacheTime !== 'undefined') {
      this.cacheManager.setCacheTime(cacheTime);
    }
  }
  
  /**
   * Create a default handler for 401 (Unauthorized) errors
   * that implements standard token refresh behavior
   */
  private createDefaultTokenRefreshHandler(): HookSettings {
    return {
      shouldRetry: true,
      useRetryDelay: true,
      preventConcurrentCalls: true,
      maxRetries: 1,
      handler: async (accountId) => {
        try {
          console.log(`🔄 Using default token refresh handler for ${accountId}`);
          
          // Get current token to extract refresh token
          const currentToken = await this.tokenService.get(accountId);
          
          if (!currentToken.refresh_token) {
            throw new Error(`No refresh token available for account ${accountId}`);
          }
          
          // Refresh the token
          const newToken = await this.tokenService.refresh!(currentToken.refresh_token, accountId);
          
          if (!newToken || !newToken.access_token) {
            throw new Error('Token refresh returned invalid data');
          }
          
          // Update the token in storage
          await this.tokenService.set({
            access_token: newToken.access_token,
            refresh_token: newToken.refresh_token || currentToken.refresh_token
          }, accountId);
          
          // Return empty object to retry with same parameters
          return {};
        } catch (error) {
          console.error(`Token refresh failed for ${accountId}:`, error);
          throw error;
        }
      },
      onMaxRetriesExceeded: async (accountId, error) => {
        console.error(`Authentication failed after refresh attempt for ${accountId}:`, error);
      }
    };
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
  public async makeApiCall(apiCallParams: Omit<ApiCallParams, 'accountId'> & { accountId?: string }): Promise<any> {
    // Use 'default' as fallback if accountId is not provided
    const params: ApiCallParams = {
      ...apiCallParams,
      accountId: apiCallParams.accountId || 'default',
    };

    console.log('🔄 makeApiCall', this.provider, params.accountId);
    
    // Check cache first
    const cachedData = this.cacheManager.getFromCache(params);
    if (cachedData) return cachedData;

    // Make the API call with retry capability
    const result = await this.makeRequestWithRetry(params);
    
    // Cache the result
    this.cacheManager.saveToCache(params, result);
    
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
        const authToken: Token | Record<string, any> = apiCallParams.useAuth !== false
          ? await this.tokenService.get(accountId)
          : {};
          
        // Verify we have authentication if required
        if (apiCallParams.useAuth !== false && !apiCallParams.accessToken && !authToken.access_token) {
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
