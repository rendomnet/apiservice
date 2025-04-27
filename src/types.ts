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
  base: string;
  body?: object;
  data?: object;
  headers?: Record<string, string>;
  queryParams?: URLSearchParams;
  accessToken?: string;
  requireAuth?: boolean;
  noContentType?: boolean;
  contentType?: string;
  cacheTime?: number;
  files?: File[];
}

interface HookSettings {
  retryCall: boolean;
  retryDelay: boolean;
  waitUntilFinished?: boolean;
  maxRetries?: number;
  callback: (accountId: string, response: any) => Promise<any>;
  onRetryFail?: (accountId: string, error: any) => Promise<void>;
  errorCallback?: (accountId: string, error: any) => Promise<void>;
  delayStrategy?: DelayStrategy;
  maxDelay?: number;
}

type StatusCode = string | number;
type TokenService = {
  get: (accountId: string) => Promise<Token>;
  set: (accountId: string, token: Partial<Token>) => Promise<void>;
  refresh?: (accountId: string, refreshToken: string) => Promise<OAuthToken>;
};

export {
  OAuthToken,
  DelayStrategy,
  Token,
  AccountData,
  ApiCallParams,
  HookSettings,
  StatusCode,
  TokenService,
};
