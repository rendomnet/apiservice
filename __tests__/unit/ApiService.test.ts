import ApiService from '../../src/index';
import { TokenAuthProvider } from '../../src/TokenAuthProvider';
import { ApiKeyAuthProvider } from '../../src/ApiKeyAuthProvider';
import { BasicAuthProvider } from '../../src/BasicAuthProvider';

const mockHttpClient = {
  makeRequest: jest.fn(),
};
const mockCacheManager = {
  getFromCache: jest.fn(),
  saveToCache: jest.fn(),
  setCacheTime: jest.fn(),
  clearCache: jest.fn(),
};
const mockRetryManager = {
  getDefaultMaxRetries: jest.fn().mockReturnValue(1),
  calculateAndDelay: jest.fn(),
  setCacheTime: jest.fn(),
};
const mockHookManager = {
  setHooks: jest.fn(),
  shouldRetry: jest.fn().mockReturnValue(false),
  getHook: jest.fn(),
  processHook: jest.fn(),
  handleRetryFailure: jest.fn(),
};
const mockAccountManager = {
  setLastRequestFailed: jest.fn(),
  updateAccountData: jest.fn(),
};

function setupApiServiceWithProvider(authProvider: any) {
  const api = new ApiService();
  api['httpClient'] = mockHttpClient as any;
  api['cacheManager'] = mockCacheManager as any;
  api['retryManager'] = mockRetryManager as any;
  api['hookManager'] = mockHookManager as any;
  api['accountManager'] = mockAccountManager as any;
  api.setup({ provider: 'test', authProvider, cacheTime: 0 });
  return api;
}

describe('ApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls API with TokenAuthProvider', async () => {
    const tokenService = {
      get: jest.fn().mockResolvedValue({ access_token: 'tok', refresh_token: 'r', accountId: 'id', provider: 'p' }),
      set: jest.fn(),
      refresh: jest.fn(),
    };
    const provider = new TokenAuthProvider(tokenService);
    mockHttpClient.makeRequest.mockResolvedValue({ ok: true });
    const api = setupApiServiceWithProvider(provider);
    await api.call({ method: 'GET', route: '/foo', accountId: 'id' });
    expect(mockHttpClient.makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
      {}
    );
  });

  it('calls API with ApiKeyAuthProvider (header)', async () => {
    const provider = new ApiKeyAuthProvider({ apiKey: 'key', headerName: 'x-api-key' });
    mockHttpClient.makeRequest.mockResolvedValue({ ok: true });
    const api = setupApiServiceWithProvider(provider);
    await api.call({ method: 'GET', route: '/foo' });
    expect(mockHttpClient.makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'key' }) }),
      {}
    );
  });

  it('calls API with ApiKeyAuthProvider (query param)', async () => {
    const provider = new ApiKeyAuthProvider({ apiKey: 'key', queryParamName: 'api_key' });
    mockHttpClient.makeRequest.mockResolvedValue({ ok: true });
    const api = setupApiServiceWithProvider(provider);
    await api.call({ method: 'GET', route: '/foo', queryParams: new URLSearchParams('a=1') });
    expect(mockHttpClient.makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ queryParams: expect.any(URLSearchParams) }),
      {}
    );
    const params = mockHttpClient.makeRequest.mock.calls[0][0];
    expect(params.queryParams.get('api_key')).toBe('key');
    expect(params.queryParams.get('a')).toBe('1');
  });

  it('calls API with BasicAuthProvider', async () => {
    const provider = new BasicAuthProvider({ username: 'user', password: 'pass' });
    mockHttpClient.makeRequest.mockResolvedValue({ ok: true });
    const api = setupApiServiceWithProvider(provider);
    await api.call({ method: 'GET', route: '/foo' });
    expect(mockHttpClient.makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Basic /) }) }),
      {}
    );
  });

  it('triggers refresh on 401 with TokenAuthProvider', async () => {
    const tokenService = {
      get: jest.fn().mockResolvedValue({ access_token: 'tok', refresh_token: 'r', accountId: 'id', provider: 'p' }),
      set: jest.fn(),
      refresh: jest.fn().mockResolvedValue({ access_token: 'newtok', refresh_token: 'newr' }),
    };
    const provider = new TokenAuthProvider(tokenService);
    // Simulate 401 error and hook
    mockHttpClient.makeRequest.mockRejectedValueOnce({ status: 401, response: {} });
    mockHttpClient.makeRequest.mockResolvedValueOnce({ ok: true });
    mockHookManager.shouldRetry.mockReturnValue(true);
    mockHookManager.getHook.mockReturnValue({
      shouldRetry: true,
      useRetryDelay: false,
      maxRetries: 1,
      handler: async () => ({}),
    });
    mockHookManager.processHook.mockResolvedValue({});
    const api = setupApiServiceWithProvider(provider);
    await api.call({ method: 'GET', route: '/foo', accountId: 'id' });
    expect(tokenService.get).toHaveBeenCalled();
    expect(mockHttpClient.makeRequest).toHaveBeenCalledTimes(2);
  });
}); 