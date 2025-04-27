# ApiService

A robust TypeScript API service framework for making authenticated API calls with advanced features:

- ✅ Authentication handling with token management
- ✅ Request caching with configurable time periods
- ✅ Advanced retry mechanisms with exponential backoff
- ✅ Status code-specific hooks for handling errors
- ✅ Account state tracking
- ✅ File upload support

## Usage

```typescript
import ApiService from '@rendomnet/apiservice';

// Create and setup the API service
const api = new ApiService();
api.setup({
  provider: 'my-service',
  tokenService: myTokenService,
  hooks: {
    401: {
      shouldRetry: true,
      useRetryDelay: true,
      handler: async (accountId, response) => {
        // Handle token refresh logic
        return { /* updated parameters */ };
      }
    }
  },
  cacheTime: 30000 // 30 seconds
});

// Make API calls
const result = await api.makeApiCall({
  accountId: 'user123',
  method: 'GET',
  base: 'https://api.example.com',
  route: '/users',
  requireAuth: true
});
```

## Hook Options

Hooks can be configured to handle specific HTTP status codes:

```typescript
const hooks = {
  401: {
    // Core settings
    shouldRetry: true,           // Whether to retry the API call when this hook is triggered
    useRetryDelay: true,         // Whether to apply delay between retries
    maxRetries: 3,               // Maximum number of retry attempts for this status code (default: 4)
    
    // Advanced options
    preventConcurrentCalls: true, // Wait for an existing hook to complete before starting a new one
                                  // Useful for avoiding duplicate refresh token calls
    
    // Handler functions
    handler: async (accountId, response) => {
      // Main handler function called when this status code is encountered
      // Return an object to update the API call parameters for the retry
      return { /* updated parameters */ };
    },
    
    onMaxRetriesExceeded: async (accountId, error) => {
      // Called when all retry attempts for this status code have failed
    },
    
    onHandlerError: async (accountId, error) => {
      // Called when the handler function throws an error
    },
    
    // Delay strategy settings
    delayStrategy: {
      calculate: (attempt, response) => {
        // Custom strategy for calculating delay between retries
        return 1000 * Math.pow(2, attempt - 1); // Exponential backoff
      }
    },
    maxDelay: 30000 // Maximum delay in milliseconds between retries (default: 60000)
  }
}
```

## Architecture

The codebase is built around a main `ApiService` class that coordinates several component managers:

- `HttpClient`: Handles the actual HTTP request creation and execution
- `CacheManager`: Implements data caching with customizable expiration times
- `RetryManager`: Manages retry logic with exponential backoff and other delay strategies
- `HookManager`: Provides a way to hook into specific status codes and handle them
- `AccountManager`: Tracks account state and handles account-specific data 