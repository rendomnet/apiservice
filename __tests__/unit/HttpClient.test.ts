import { HttpClient } from '../../src/HttpClient';
import { FetchError } from '../../src/FetchError';
import { ApiCallParams } from '../../src/types';
import qs from 'qs';

// Mock qs module to control the query string format
jest.mock('qs', () => ({
  stringify: jest.fn().mockImplementation((params) => {
    return Object.entries(params).map(([key, value]) => `${key}=${value}`).join('&');
  }),
}));

// Mock global fetch
global.fetch = jest.fn();

// Mock console.log and console.error to reduce noise in test output
console.log = jest.fn();
console.error = jest.fn();

describe('HttpClient', () => {
  let httpClient: HttpClient;
  const mockAuthToken = { access_token: 'test-token' };
  
  beforeEach(() => {
    httpClient = new HttpClient();
    jest.clearAllMocks();
    
    // Default mock implementation for fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });
  });
  
  describe('makeRequest', () => {
    it('should make a successful API call', async () => {
      const apiParams: ApiCallParams = {
        accountId: 'test-account',
        method: 'GET',
        base: 'https://api.example.com',
        route: '/users',
        useAuth: true,
      };
      
      const result = await httpClient.makeRequest(apiParams, mockAuthToken);
      
      expect(result).toEqual({ success: true, data: [] });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });
    
    it('should handle query parameters', async () => {
      // Create a mock implementation for this test
      (qs.stringify as jest.Mock).mockImplementationOnce(() => 'page=1&limit=10');
      
      const apiParams: ApiCallParams = {
        accountId: 'test-account',
        method: 'GET',
        base: 'https://api.example.com',
        route: '/users',
        queryParams: new URLSearchParams({ page: '1', limit: '10' }),
        useAuth: true,
      };
      
      await httpClient.makeRequest(apiParams, mockAuthToken);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users?page=1&limit=10',
        expect.anything()
      );
    });
    
    it('should handle POST requests with body', async () => {
      const apiParams: ApiCallParams = {
        accountId: 'test-account',
        method: 'POST',
        base: 'https://api.example.com',
        route: '/users',
        body: { name: 'Test User', email: 'test@example.com' },
        useAuth: true,
      };
      
      await httpClient.makeRequest(apiParams, mockAuthToken);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
          body: JSON.stringify({ name: 'Test User', email: 'test@example.com' }),
        })
      );
    });
    
    it('should handle failed API calls', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Resource not found' }),
      });
      
      const apiParams: ApiCallParams = {
        accountId: 'test-account',
        method: 'GET',
        base: 'https://api.example.com',
        route: '/users/999',
        useAuth: true,
      };
      
      await expect(httpClient.makeRequest(apiParams, mockAuthToken))
        .rejects.toBeInstanceOf(FetchError);
    });
    
    it('should handle API calls without authentication', async () => {
      const apiParams: ApiCallParams = {
        accountId: 'test-account',
        method: 'GET',
        base: 'https://api.example.com',
        route: '/public/data',
        useAuth: false,
      };
      
      await httpClient.makeRequest(apiParams, mockAuthToken);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/public/data',
        expect.objectContaining({
          method: 'GET',
          headers: expect.not.objectContaining({
            Authorization: expect.anything(),
          }),
        })
      );
    });
    
    it('should use a forced access token when provided', async () => {
      const apiParams: ApiCallParams = {
        accountId: 'test-account',
        method: 'GET',
        base: 'https://api.example.com',
        route: '/users',
        useAuth: true,
        accessToken: 'forced-token',
      };
      
      await httpClient.makeRequest(apiParams, mockAuthToken);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer forced-token',
          }),
        })
      );
    });
    
    it('should handle undefined base url', async () => {
      const apiParams: ApiCallParams = {
        accountId: 'test-account',
        method: 'GET',
        route: '/users',
        useAuth: true,
      };
      
      await httpClient.makeRequest(apiParams, mockAuthToken);
      
      expect(global.fetch).toHaveBeenCalledWith(
        '/users',
        expect.anything()
      );
    });
  });

  describe('buildUrl', () => {
    it('should build URL with base and route', () => {
      // Access private method using type assertion
      const buildUrl = (httpClient as any).buildUrl.bind(httpClient);
      
      const url = buildUrl('https://api.example.com', '/users');
      expect(url).toBe('https://api.example.com/users');
    });
    
    it('should handle undefined base', () => {
      const buildUrl = (httpClient as any).buildUrl.bind(httpClient);
      
      const url = buildUrl(undefined, '/users');
      expect(url).toBe('/users');
    });
    
    it('should handle undefined route', () => {
      const buildUrl = (httpClient as any).buildUrl.bind(httpClient);
      
      const url = buildUrl('https://api.example.com');
      expect(url).toBe('https://api.example.com');
    });
  });
}); 