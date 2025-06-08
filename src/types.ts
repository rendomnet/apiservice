// Interfaces
interface OAuthToken {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
}

interface Token {
  accountId: string;
  access_token: string;
  refresh_token: string;
  provider: string;
  enabled?: boolean;
  updatedAt?: string;
  primary?: boolean;
}

interface AccountData {
  lastRequestTime?: number;
  lastFailed?: boolean;
  token?: Token;
}

interface DelayStrategy {
  calculate: (attempt: number, response?: any) => number;
}

interface ApiCallParams {
  accountId: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  route: string;
  base?: string;
  body?: object;
  data?: object;
  headers?: Record<string, string>;
  queryParams?: URLSearchParams;
  accessToken?: string;
  useAuth?: boolean;
  noContentType?: boolean;
  contentType?: string;
  cacheTime?: number;
  files?: File[];
  abortSignal?: AbortSignal;
}

interface HookSettings {
  /**
   * Whether to retry the API call when this hook is triggered
   */
  shouldRetry: boolean;
  
  /**
   * Whether to apply delay between retries
   */
  useRetryDelay: boolean;
  
  /**
   * The maximum number of retry attempts for this status code
   */
  maxRetries?: number;
  
  /**
   * Wait for an existing hook to complete before starting a new one
   * Useful for avoiding duplicate refresh token calls
   */
  preventConcurrentCalls?: boolean;
  
  /**
   * The main handler function called when this status code is encountered
   * Return an object to update the API call parameters for the retry
   */
  handler: (accountId: string, response: any) => Promise<any>;
  
  /**
   * Called when all retry attempts for this status code have failed
   */
  onMaxRetriesExceeded?: (accountId: string, error: any) => Promise<void>;
  
  /**
   * Called when the handler function throws an error
   */
  onHandlerError?: (accountId: string, error: any) => Promise<void>;
  
  /**
   * Custom strategy for calculating delay between retries
   */
  delayStrategy?: DelayStrategy;
  
  /**
   * Maximum delay in milliseconds between retries
   */
  maxDelay?: number;
}

type StatusCode = string | number;

interface AuthProvider {
  /**
   * Returns headers or other auth data for a request
   */
  getAuthHeaders(accountId?: string): Promise<Record<string, string>>;
  /**
   * Optional: refresh credentials if supported (for OAuth, etc.)
   */
  refresh?(refreshToken: string, accountId?: string): Promise<any>;
}

interface ApiKeyAuthProviderOptions {
  apiKey: string;
  headerName?: string;
  queryParamName?: string;
}

interface BasicAuthProviderOptions {
  username: string;
  password: string;
}

type TokenService = {
  get: (accountId?: string) => Promise<Token>;
  set: (token: Partial<Token>, accountId?: string) => Promise<void>;
  refresh?: (refreshToken: string, accountId?: string) => Promise<OAuthToken>;
};

export {
  OAuthToken,
  DelayStrategy,
  Token,
  AccountData,
  ApiCallParams,
  HookSettings,
  StatusCode,
  AuthProvider,
  ApiKeyAuthProviderOptions,
  BasicAuthProviderOptions,
  TokenService,
};
