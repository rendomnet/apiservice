import { TokenAuthProvider } from '../../src/TokenAuthProvider';
import { ApiKeyAuthProvider } from '../../src/ApiKeyAuthProvider';
import { BasicAuthProvider } from '../../src/BasicAuthProvider';

describe('AuthProvider Implementations', () => {
  describe('TokenAuthProvider', () => {
    const mockTokenService = {
      get: jest.fn().mockResolvedValue({ access_token: 'abc', refresh_token: 'refresh', accountId: 'id', provider: 'p' }),
      set: jest.fn(),
      refresh: jest.fn().mockResolvedValue({ access_token: 'newabc', refresh_token: 'newrefresh' })
    };
    const provider = new TokenAuthProvider(mockTokenService);
    it('returns Bearer header', async () => {
      const headers = await provider.getAuthHeaders('id');
      expect(headers).toEqual({ Authorization: 'Bearer abc' });
    });
    it('calls refresh and set', async () => {
      await provider.refresh('refresh', 'id');
      expect(mockTokenService.refresh).toHaveBeenCalledWith('refresh', 'id');
      expect(mockTokenService.set).toHaveBeenCalledWith({ access_token: 'newabc', refresh_token: 'newrefresh' }, 'id');
    });
  });

  describe('ApiKeyAuthProvider', () => {
    it('returns header if headerName is set', async () => {
      const provider = new ApiKeyAuthProvider({ apiKey: 'key', headerName: 'x-api-key' });
      const headers = await provider.getAuthHeaders();
      expect(headers).toEqual({ 'x-api-key': 'key' });
    });
    it('returns empty headers if using query param', async () => {
      const provider = new ApiKeyAuthProvider({ apiKey: 'key', queryParamName: 'api_key' });
      const headers = await provider.getAuthHeaders();
      expect(headers).toEqual({});
    });
  });

  describe('BasicAuthProvider', () => {
    it('returns Basic auth header', async () => {
      const provider = new BasicAuthProvider({ username: 'user', password: 'pass' });
      const headers = await provider.getAuthHeaders();
      expect(headers.Authorization).toMatch(/^Basic /);
    });
  });
}); 