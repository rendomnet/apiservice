import { 
  AuthProvider,
  ApiCallParams,
  HookSettings,
  StatusCode,
  Token,
  OAuthToken
} from './types';
import { ApiKeyAuthProvider } from './ApiKeyAuthProvider';
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
  private authProvider: AuthProvider;
  private baseUrl: string = ''; // Default base URL
  
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
    this.authProvider = {} as AuthProvider;
    
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
    authProvider,
    hooks = {},
    cacheTime,
    baseUrl = '',
  }: {
    provider: string;
    authProvider: AuthProvider;
    hooks?: Record<StatusCode, HookSettings | null>;
    cacheTime: number;
    baseUrl?: string;
  }) {
    this.provider = provider;
    this.authProvider = authProvider;
    this.baseUrl = baseUrl;
    
    // Create a copy of hooks to avoid modifying the input
    const finalHooks: Record<StatusCode, HookSettings> = {};
    
    // Apply default 401 handler if:
    // 1. No 401 hook is explicitly defined (or is explicitly null)
    // 2. AuthProvider has a refresh method
    if (hooks[401] === undefined && typeof this.authProvider.refresh === 'function') {
      finalHooks[401] = this.createDefaultAuthRefreshHandler();
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
   * that implements standard credential refresh behavior
   */
  private createDefaultAuthRefreshHandler(): HookSettings {
    return {
      shouldRetry: true,
      useRetryDelay: true,
      preventConcurrentCalls: true,
      maxRetries: 1,
      handler: async (accountId) => {
        try {
          console.log(`🔄 Using default auth refresh handler for ${accountId}`);
          if (!this.authProvider.refresh) {
            throw new Error('No refresh method available on auth provider');
          }
          // You may want to store refresh token in account data or pass it in another way
          // For now, assume refresh token is managed internally by the provider
          await this.authProvider.refresh('', accountId);
          return {};
        } catch (error) {
          console.error(`Auth refresh failed for ${accountId}:`, error);
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
   * Make an API call with all features (caching, retry, hooks)
   */
  public async call(apiCallParams: Omit<ApiCallParams, 'accountId'> & { accountId?: string }): Promise<any> {
    // Use 'default' as fallback if accountId is not provided
    // and use default baseUrl if not provided
    const params: ApiCallParams = {
      ...apiCallParams,
      accountId: apiCallParams.accountId || 'default',
      base: apiCallParams.base || this.baseUrl,
    };

    // If using ApiKeyAuthProvider with queryParamName, add API key to queryParams
    if (
      this.authProvider instanceof ApiKeyAuthProvider &&
      (this.authProvider as any).queryParamName
    ) {
      const queryParamName = (this.authProvider as any).queryParamName;
      const apiKey = (this.authProvider as any).apiKey;
      const urlParams = params.queryParams ? new URLSearchParams(params.queryParams) : new URLSearchParams();
      urlParams.set(queryParamName, apiKey);
      params.queryParams = urlParams;
    }

    console.log('🔄 API call', this.provider, params.accountId, params.method, params.route);
    
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
   * Legacy method for backward compatibility
   * @deprecated Use call() instead
   */
  public async makeApiCall(apiCallParams: Omit<ApiCallParams, 'accountId'> & { accountId?: string }): Promise<any> {
    return this.call(apiCallParams);
  }

  /**
   * Make a request with retry capability
   */
  private async makeRequestWithRetry(apiCallParams: ApiCallParams): Promise<any> {
    const { accountId } = apiCallParams;
    let attempts = 0;
    const statusRetries: Record<StatusCode, number> = {};
    let currentParams = { ...apiCallParams };
    // If using ApiKeyAuthProvider with queryParamName, add API key to queryParams
    if (
      this.authProvider instanceof ApiKeyAuthProvider &&
      (this.authProvider as any).queryParamName
    ) {
      const queryParamName = (this.authProvider as any).queryParamName;
      const apiKey = (this.authProvider as any).apiKey;
      const urlParams = currentParams.queryParams ? new URLSearchParams(currentParams.queryParams) : new URLSearchParams();
      urlParams.set(queryParamName, apiKey);
      currentParams.queryParams = urlParams;
    }
    // Main retry loop
    while (attempts < this.maxAttempts) {
      attempts++;
      
      try {
        // Get authentication headers if needed
        const authHeaders: Record<string, string> = apiCallParams.useAuth !== false
          ? await this.authProvider.getAuthHeaders(accountId)
          : {};
        // Merge auth headers into params.headers
        currentParams.headers = {
          ...(currentParams.headers || {}),
          ...authHeaders,
        };
        
        // Verify we have authentication if required
        if (apiCallParams.useAuth !== false && Object.keys(authHeaders).length === 0) {
          throw new Error(`${this.provider} credentials not found for account ID ${accountId}`);
        }
        
        // Make the actual API call
        const response = await this.httpClient.makeRequest(currentParams, {});
        
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
