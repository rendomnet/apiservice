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

  it('automatically retrieves and uses refresh token on 401', async () => {
    const tokenService = {
      get: jest.fn()
        .mockResolvedValueOnce({ access_token: 'stale_token', refresh_token: 'my_refresh_token', accountId: 'id', provider: 'p' })
        .mockResolvedValueOnce({ access_token: 'stale_token', refresh_token: 'my_refresh_token', accountId: 'id', provider: 'p' })
        .mockResolvedValueOnce({ access_token: 'fresh_token', refresh_token: 'new_refresh_token', accountId: 'id', provider: 'p' }),
      set: jest.fn(),
      refresh: jest.fn().mockResolvedValue({ access_token: 'fresh_token', refresh_token: 'new_refresh_token' }),
    };
    const provider = new TokenAuthProvider(tokenService);

    mockHttpClient.makeRequest
      .mockRejectedValueOnce({ status: 401, response: {} })
      .mockResolvedValueOnce({ ok: true });

    const api = new ApiService();
    api['httpClient'] = mockHttpClient as any;
    api['cacheManager'] = mockCacheManager as any;
    api['retryManager'] = mockRetryManager as any;
    api['accountManager'] = mockAccountManager as any;
    api.setup({ provider: 'test', authProvider: provider, cacheTime: 0 });

    await api.call({ method: 'GET', route: '/protected', accountId: 'id' });

    // Verify that the refresh flow was triggered
    expect(tokenService.refresh).toHaveBeenCalledWith('my_refresh_token', 'id');
    expect(tokenService.set).toHaveBeenCalledWith({ access_token: 'fresh_token', refresh_token: 'new_refresh_token' }, 'id');

    // Verify the API call was retried with the new token
    expect(mockHttpClient.makeRequest).toHaveBeenCalledTimes(2);
    expect(mockHttpClient.makeRequest).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fresh_token' }) }),
      {}
    );
  });
}); 