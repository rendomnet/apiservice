import { RetryManager } from '../../src/RetryManager';
import { HookSettings } from '../../src/types';

// Mock console.log to reduce noise in test output
console.log = jest.fn();

describe('RetryManager', () => {
  let retryManager: RetryManager;
  
  beforeEach(() => {
    retryManager = new RetryManager();
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  describe('getDefaultMaxRetries', () => {
    it('should return the default max retries value', () => {
      expect(retryManager.getDefaultMaxRetries()).toBe(4);
    });
  });
  
  describe('setDefaultMaxRetries', () => {
    it('should set the default max retries value', () => {
      retryManager.setDefaultMaxRetries(10);
      expect(retryManager.getDefaultMaxRetries()).toBe(10);
    });
  });
  
  describe('setDefaultMaxDelay', () => {
    it('should set the default max delay value', () => {
      const newDelay = 30000; // 30 seconds
      
      // We can't directly test private properties, so we test indirectly
      const mockHook: HookSettings = {
        shouldRetry: true,
        useRetryDelay: true,
        handler: jest.fn(),
        delayStrategy: {
          calculate: () => 100000, // Very large delay to ensure it gets capped
        },
      };
      
      // Set new max delay
      retryManager.setDefaultMaxDelay(newDelay);
      
      // Set up a spy to check setTimeout was called with the expected delay
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Call the method but don't wait for the promise
      retryManager.calculateAndDelay({ attempt: 1, hook: mockHook });
      
      // Check that setTimeout was called with the correct delay
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), newDelay);
      
      // Clear the spy
      setTimeoutSpy.mockRestore();
    });
  });
  
  describe('calculateAndDelay', () => {
    it('should use default delay strategy if none provided', () => {
      const mockHook: HookSettings = {
        shouldRetry: true,
        useRetryDelay: true,
        handler: jest.fn(),
      };
      
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Call the method but don't wait for the promise
      retryManager.calculateAndDelay({ attempt: 1, hook: mockHook });
      
      // Default strategy is exponential backoff with jitter, so should call setTimeout
      expect(setTimeoutSpy).toHaveBeenCalled();
      
      // Restore the spy
      setTimeoutSpy.mockRestore();
    });
    
    it('should use custom delay strategy if provided', () => {
      const customDelay = 5000;
      const mockHook: HookSettings = {
        shouldRetry: true,
        useRetryDelay: true,
        handler: jest.fn(),
        delayStrategy: {
          calculate: () => customDelay,
        },
      };
      
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Call the method but don't wait for the promise
      retryManager.calculateAndDelay({ attempt: 1, hook: mockHook });
      
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), customDelay);
      
      // Restore the spy
      setTimeoutSpy.mockRestore();
    });
    
    it('should respect maxDelay from hook settings', () => {
      const customMaxDelay = 3000;
      const mockHook: HookSettings = {
        shouldRetry: true,
        useRetryDelay: true,
        handler: jest.fn(),
        maxDelay: customMaxDelay,
        delayStrategy: {
          calculate: () => 10000, // This would exceed our max delay
        },
      };
      
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Call the method but don't wait for the promise
      retryManager.calculateAndDelay({ attempt: 1, hook: mockHook });
      
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), customMaxDelay);
      
      // Restore the spy
      setTimeoutSpy.mockRestore();
    });
    
    it('should respect Retry-After header if present', () => {
      const retryAfterValue = 30;
      const expectedDelay = retryAfterValue * 1000;
      
      const mockResponse = {
        headers: {
          get: jest.fn().mockImplementation((headerName) => {
            if (headerName === 'Retry-After') return retryAfterValue.toString();
            return null;
          }),
        },
      };
      
      const mockHook: HookSettings = {
        shouldRetry: true,
        useRetryDelay: true,
        handler: jest.fn(),
      };
      
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Call the method but don't wait for the promise
      retryManager.calculateAndDelay({ 
        attempt: 1, 
        response: mockResponse, 
        hook: mockHook 
      });
      
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), expectedDelay);
      
      // Restore the spy
      setTimeoutSpy.mockRestore();
    });
    
    it('should handle Retry-After with date value', () => {
      const futureDate = new Date(Date.now() + 10000); // 10 seconds in the future
      
      const mockResponse = {
        headers: {
          get: jest.fn().mockImplementation((headerName) => {
            if (headerName === 'Retry-After') return futureDate.toString();
            return null;
          }),
        },
      };
      
      const mockHook: HookSettings = {
        shouldRetry: true,
        useRetryDelay: true,
        handler: jest.fn(),
      };
      
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Call the method but don't wait for the promise
      retryManager.calculateAndDelay({ 
        attempt: 1, 
        response: mockResponse, 
        hook: mockHook 
      });
      
      // The delay should be roughly 10000ms (allow some variation for processing time)
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function), 
        expect.any(Number)
      );
      
      const actualDelay = setTimeoutSpy.mock.calls[0][1];
      expect(actualDelay).toBeGreaterThan(1000); // Some substantial delay
      
      // Restore the spy
      setTimeoutSpy.mockRestore();
    });
  });
}); 