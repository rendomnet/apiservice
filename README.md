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
import ApiService from 'apiservice';

// Create and setup the API service
const api = new ApiService();
api.setup({
  provider: 'my-service',
  tokenService: myTokenService,
  hooks: {
    401: {
      retryCall: true,
      retryDelay: true,
      callback: async (accountId, response) => {
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

## Architecture

The codebase is built around a main `ApiService` class that coordinates several component managers:

- `HttpClient`: Handles the actual HTTP request creation and execution
- `CacheManager`: Implements data caching with customizable expiration times
- `RetryManager`: Manages retry logic with exponential backoff and other delay strategies
- `HookManager`: Provides a way to hook into specific status codes and handle them
- `AccountManager`: Tracks account state and handles account-specific data 