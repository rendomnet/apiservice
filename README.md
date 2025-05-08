# ApiService

A robust TypeScript API service framework for making authenticated API calls with advanced features:

- ✅ Multiple authentication strategies (token, API key, basic auth, custom)
- ✅ Request caching with configurable time periods
- ✅ Advanced retry mechanisms with exponential backoff
- ✅ Status code-specific hooks for handling errors
- ✅ Account state tracking
- ✅ File upload support
- ✅ Support for multiple accounts or a single default account
- ✅ Automatic token refresh for 401 errors (if supported by provider)

## Installation

```bash
npm install @rendomnet/apiservice
```

## Testing

ApiService includes a comprehensive test suite using Jest. To run the tests:

```bash
# Run tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch
```

## Usage

```typescript
import ApiService from 'apiservice';
import { TokenAuthProvider, ApiKeyAuthProvider, BasicAuthProvider } from 'apiservice';

// Token-based (OAuth2, etc.)
const tokenProvider = new TokenAuthProvider(myTokenService);

// API key in header
const apiKeyHeaderProvider = new ApiKeyAuthProvider({ apiKey: 'my-key', headerName: 'x-api-key' });

// API key in query param
const apiKeyQueryProvider = new ApiKeyAuthProvider({ apiKey: 'my-key', queryParamName: 'api_key' });

// Basic Auth
const basicProvider = new BasicAuthProvider({ username: 'user', password: 'pass' });

// Create and setup the API service
const api = new ApiService();
api.setup({
  provider: 'my-service',
  authProvider: tokenProvider, // or apiKeyHeaderProvider, apiKeyQueryProvider, basicProvider
  hooks: {
    // You can define custom hooks here,
    // or use the default token refresh handler for 401 errors (if supported)
  },
  cacheTime: 30000, // 30 seconds
  baseUrl: 'https://api.example.com' // Set default base URL
});

// Make API calls with specific account ID and use default baseUrl
const result = await api.call({
  accountId: 'user123',
  method: 'GET',
  route: '/users',
  useAuth: true
});

// Override default baseUrl for specific calls
const customResult = await api.call({
  method: 'GET',
  base: 'https://api2.example.com', // Override default baseUrl
  route: '/users',
  useAuth: true
});

// Or omit accountId to use the default account ('default')
const defaultResult = await api.call({
  method: 'GET',
  route: '/users',
  useAuth: true
});
```

## Authentication Providers

ApiService supports multiple authentication strategies via the `AuthProvider` interface. You can use built-in providers or implement your own.

### TokenAuthProvider (OAuth2, Bearer Token)

```typescript
import { TokenAuthProvider } from 'apiservice';

const tokenService = {
  async get(accountId = 'default') {
    // Get token from storage
    return storedToken;
  },
  async set(token, accountId = 'default') {
    // Save token to storage
  },
  async refresh(refreshToken, accountId = 'default') {
    // Refresh the token with your OAuth provider
    // ...
    return newToken;
  }
};

const tokenProvider = new TokenAuthProvider(tokenService);
```

### ApiKeyAuthProvider (Header or Query Param)

```typescript
import { ApiKeyAuthProvider } from 'apiservice';

// API key in header
const apiKeyHeaderProvider = new ApiKeyAuthProvider({ apiKey: 'my-key', headerName: 'x-api-key' });

// API key in query param
const apiKeyQueryProvider = new ApiKeyAuthProvider({ apiKey: 'my-key', queryParamName: 'api_key' });
```

### BasicAuthProvider

```typescript
import { BasicAuthProvider } from 'apiservice';

const basicProvider = new BasicAuthProvider({ username: 'user', password: 'pass' });
```

### Custom AuthProvider

You can implement your own provider by implementing the `AuthProvider` interface:

```typescript
interface AuthProvider {
  getAuthHeaders(accountId?: string): Promise<Record<string, string>>;
  refresh?(refreshToken: string, accountId?: string): Promise<any>;
}
```

## Automatic Token Refresh

If your provider supports token refresh (like `TokenAuthProvider`), ApiService includes a built-in handler for 401 (Unauthorized) errors that automatically refreshes tokens. This feature:

1. Detects 401 errors from the API
2. Calls the provider's `refresh` method
3. Retries the original API request with the new token

To use this feature:

- Use a provider that implements `refresh` (like `TokenAuthProvider`)
- Don't specify a custom 401 hook (the default will be used automatically)

If you prefer to handle token refresh yourself, you can either:

1. Provide your own handler for 401 errors which will override the default
2. Disable the default handler by setting `hooks: { 401: null }`

```typescript
api.setup({
  provider: 'my-service',
  authProvider: tokenProvider,
  hooks: {
    401: null // Explicitly disable the default handler
  },
  cacheTime: 30000
});
```

## Account Management

ApiService supports multiple accounts through the `accountId` parameter. This allows you to:

1. **Manage multiple tokens** - Maintain separate authentication tokens for different users or services
2. **Track state by account** - Each account has its own state tracking (request times, failures)
3. **Apply account-specific retry logic** - Hooks can behave differently based on the account

For simple applications that only need a single account, you can omit the accountId parameter:

```typescript
// Make calls without specifying accountId - uses 'default' automatically
const result = await api.call({
  method: 'GET',
  route: '/users'
});
```

If no accountId is provided, ApiService automatically uses 'default' as the account ID.

## AuthProvider Interface

```typescript
interface AuthProvider {
  getAuthHeaders(accountId?: string): Promise<Record<string, string>>;
  refresh?(refreshToken: string, accountId?: string): Promise<any>;
}
```

## Example: Complete Authorization Flow (TokenAuthProvider)

```typescript
import ApiService from 'apiservice';
import { TokenAuthProvider } from 'apiservice';

const tokenService = {
  async get(accountId = 'default') {
    // ...
  },
  async set(token, accountId = 'default') {
    // ...
  },
  async refresh(refreshToken, accountId = 'default') {
    // ...
  }
};

const api = new ApiService();
api.setup({
  provider: 'example-api',
  authProvider: new TokenAuthProvider(tokenService),
  cacheTime: 30000,
  baseUrl: 'https://api.example.com',
  hooks: {
    403: {
      shouldRetry: false,
      handler: async (accountId, response) => {
        // ...
        return null;
      }
    }
  }
});

// Use the API service
async function fetchUserData(userId) {
  return await api.call({
    method: 'GET',
    route: `/users/${userId}`,
    useAuth: true
  });
}
```

## Hook Options

Hooks can be configured to handle specific HTTP status codes:

```typescript
const hooks = {
  401: {
    shouldRetry: true,
    useRetryDelay: true,
    maxRetries: 3,
    preventConcurrentCalls: true,
    handler: async (accountId, response) => {
      // ...
      return { /* updated parameters */ };
    },
    onMaxRetriesExceeded: async (accountId, error) => {
      // ...
    },
    onHandlerError: async (accountId, error) => {
      // ...
    },
    delayStrategy: {
      calculate: (attempt, response) => 1000 * Math.pow(2, attempt - 1)
    },
    maxDelay: 30000
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

## Advanced Usage

### Multiple API Providers

```typescript
import { ApiService, TokenAuthProvider, ApiKeyAuthProvider } from 'apiservice';

const primaryProvider = new TokenAuthProvider(primaryTokenService);
const secondaryProvider = new ApiKeyAuthProvider({ apiKey: 'secondary-key', headerName: 'x-api-key' });

const api = new ApiService();
api.setup({
  provider: 'primary-api',
  authProvider: primaryProvider,
  cacheTime: 30000,
  baseUrl: 'https://api.primary.com'
});

api.setup({
  provider: 'secondary-api',
  authProvider: secondaryProvider,
  cacheTime: 60000,
  baseUrl: 'https://api.secondary.com'
});

// Use different providers in API calls
async function fetchCombinedData() {
  const [primaryData, secondaryData] = await Promise.all([
    api.call({
      provider: 'primary-api',
      method: 'GET',
      route: '/data',
      useAuth: true
    }),
    api.call({
      provider: 'secondary-api',
      method: 'GET',
      route: '/data',
      useAuth: true
    }),
    api.call({
      provider: 'primary-api',
      method: 'GET',
      route: '/special-data',
      useAuth: true,
      base: 'https://special-api.primary.com'
    })
  ]);
  return { primaryData, secondaryData };
}
```