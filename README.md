# ApiService

A robust TypeScript API service framework for making authenticated API calls with advanced features:

- ✅ Authentication handling with token management
- ✅ Request caching with configurable time periods
- ✅ Advanced retry mechanisms with exponential backoff
- ✅ Status code-specific hooks for handling errors
- ✅ Account state tracking
- ✅ File upload support
- ✅ Support for multiple accounts or a single default account
- ✅ Automatic token refresh for 401 errors

## Usage

```typescript
import ApiService from '@rendomnet/apiservice';

// Create and setup the API service
const api = new ApiService();
api.setup({
  provider: 'my-service', // 'google' | 'microsoft' and etc.
  tokenService: myTokenService,
  hooks: {
    // You can define custom hooks here,
    // or use the default token refresh handler for 401 errors
  },
  cacheTime: 30000, // 30 seconds
  enableDefaultHandlers: true // Enable automatic token refresh (default: true)
});

// Make API calls with specific account ID
const result = await api.makeApiCall({
  accountId: 'user123',
  method: 'GET',
  base: 'https://api.example.com',
  route: '/users',
  requireAuth: true
});

// Or omit accountId to use the default account ('default')
const defaultResult = await api.makeApiCall({
  method: 'GET',
  base: 'https://api.example.com',
  route: '/users',
  requireAuth: true
});
```

## Automatic Token Refresh

ApiService includes a built-in handler for 401 (Unauthorized) errors that automatically refreshes OAuth tokens. When enabled, this feature:

1. Detects 401 errors from the API
2. Retrieves the current token for the account
3. Uses the `refresh` method from your tokenService to obtain a new token
4. Updates the stored token with the new one
5. Retries the original API request with the new token

To use this feature:

1. Ensure your tokenService implements the `refresh` method
2. Keep `enableDefaultHandlers: true` in your setup (this is the default)

```typescript
// Example token service with refresh capability
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
    const response = await fetch('https://api.example.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: 'your-client-id'
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }
    
    return await response.json();
  }
};
```

If you prefer to handle token refresh yourself, you can either:

1. Disable default handlers: `enableDefaultHandlers: false`
2. Or provide your own handler for 401 errors which will override the default

## Account Management

ApiService supports multiple accounts through the `accountId` parameter. This allows you to:

1. **Manage multiple tokens** - Maintain separate authentication tokens for different users or services
2. **Track state by account** - Each account has its own state tracking (request times, failures)
3. **Apply account-specific retry logic** - Hooks can behave differently based on the account

For simple applications that only need a single account, you can omit the accountId parameter:

```typescript
// Make calls without specifying accountId - uses 'default' automatically
const result = await api.makeApiCall({
  method: 'GET',
  base: 'https://api.example.com',
  route: '/users'
});
```

If no accountId is provided, ApiService automatically uses 'default' as the account ID.

## Token Service

ApiService requires a `tokenService` for authentication. This service manages tokens for different accounts and handles token retrieval, storage, and refresh operations.

### TokenService Interface

```typescript
interface TokenService {
  // Get a token for an account (accountId is optional, defaults to 'default')
  get: (accountId?: string) => Promise<Token>;
  
  // Save a token for an account
  set: (token: Partial<Token>, accountId?: string) => Promise<void>;
  
  // Optional: Refresh an expired token
  refresh?: (refreshToken: string, accountId?: string) => Promise<OAuthToken>;
}

// The Token interface
interface Token {
  accountId: string;
  access_token: string;
  refresh_token: string;
  provider: string;
  enabled?: boolean;
  updatedAt?: string;
  primary?: boolean;
}

// OAuth token response
interface OAuthToken {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
}
```

### Example Implementation

Here's a simple `tokenService` implementation using localStorage:

```typescript
// Simple token service implementation
const tokenService = {
  // Get token for an account
  async get(accountId = 'default'): Promise<Token> {
    const storedToken = localStorage.getItem(`token-${accountId}`);
    if (!storedToken) {
      throw new Error(`No token found for account ${accountId}`);
    }
    return JSON.parse(storedToken);
  },
  
  // Save token for an account
  async set(token: Partial<Token>, accountId = 'default'): Promise<void> {
    const existingToken = localStorage.getItem(`token-${accountId}`);
    const currentToken = existingToken ? JSON.parse(existingToken) : { accountId };
    const updatedToken = { ...currentToken, ...token, updatedAt: new Date().toISOString() };
    localStorage.setItem(`token-${accountId}`, JSON.stringify(updatedToken));
  },
  
  // Refresh token implementation
  async refresh(refreshToken: string, accountId = 'default'): Promise<OAuthToken> {
    // Make a request to your OAuth token endpoint
    const response = await fetch('https://api.example.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: 'your-client-id'
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }
    
    const newToken = await response.json();
    
    // Update the stored token
    await this.set({
      access_token: newToken.access_token,
      refresh_token: newToken.refresh_token
    }, accountId);
    
    return newToken;
  }
};
```

### Complete Authorization Flow Example

Here's a complete example showing how to use ApiService with automatic token refresh:

```typescript
import ApiService from '@rendomnet/apiservice';

// Create token service with refresh capability
const tokenService = {
  // Get token from storage
  async get(accountId = 'default') {
    const storedToken = localStorage.getItem(`token-${accountId}`);
    if (!storedToken) {
      throw new Error(`No token found for account ${accountId}`);
    }
    return JSON.parse(storedToken);
  },
  
  // Save token to storage
  async set(token, accountId = 'default') {
    const existingToken = localStorage.getItem(`token-${accountId}`);
    const currentToken = existingToken ? JSON.parse(existingToken) : { accountId };
    const updatedToken = { ...currentToken, ...token, updatedAt: new Date().toISOString() };
    localStorage.setItem(`token-${accountId}`, JSON.stringify(updatedToken));
  },
  
  // Refresh token with OAuth provider
  async refresh(refreshToken, accountId = 'default') {
    // Real implementation would call your OAuth endpoint
    const response = await fetch('https://api.example.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: 'your-client-id'
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }
    
    return await response.json();
  }
};

// Create API service instance
const api = new ApiService();

// Configure API service with default handlers enabled
api.setup({
  provider: 'example-api',
  tokenService,
  cacheTime: 30000,
  // enableDefaultHandlers: true is the default and doesn't need to be specified
  
  // You can still add custom hooks for other status codes
  hooks: {
    // Handle 403 Forbidden errors - typically for insufficient permissions
    403: {
      shouldRetry: false,
      handler: async (accountId, response) => {
        console.warn('Permission denied:', response);
        // You could trigger a permissions UI here
        window.dispatchEvent(new CustomEvent('permission:required', { 
          detail: { accountId, resource: response.resource } 
        }));
        return null;
      }
    }
  }
});

// Use the API service
async function fetchUserData(userId) {
  try {
    return await api.makeApiCall({
      // No accountId needed - will use 'default' automatically
      method: 'GET',
      base: 'https://api.example.com',
      route: `/users/${userId}`,
      requireAuth: true
    });
  } catch (error) {
    // 401 errors with valid refresh tokens will be automatically handled
    // This catch will only trigger for other errors or if refresh fails
    console.error('Failed to fetch user data:', error);
    throw error;
  }
}
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