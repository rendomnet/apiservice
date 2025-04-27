# ApiService

A robust TypeScript API service framework for making authenticated API calls with advanced features:

- ✅ Authentication handling with token management
- ✅ Request caching with configurable time periods
- ✅ Advanced retry mechanisms with exponential backoff
- ✅ Status code-specific hooks for handling errors
- ✅ Account state tracking
- ✅ File upload support
- ✅ Support for multiple accounts or a single default account

## Usage

```typescript
import ApiService from '@rendomnet/apiservice';

// Create and setup the API service
const api = new ApiService();
api.setup({
  provider: 'my-service', // 'google' | 'microsoft' and etc.
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

Here's a complete example showing how to handle token refreshing with ApiService:

```typescript
import ApiService from '@rendomnet/apiservice';

// Create token service
const tokenService = {
  async get(accountId = 'default') { /* implementation as above */ },
  async set(token, accountId = 'default') { /* implementation as above */ },
  async refresh(refreshToken, accountId = 'default') { /* implementation as above */ }
};

// Create API service instance
const api = new ApiService();

// Configure API service with hooks for handling auth errors
api.setup({
  provider: 'example-api',
  tokenService,
  hooks: {
    // Handle 401 Unauthorized errors - typically for expired tokens
    401: {
      shouldRetry: true,
      useRetryDelay: true,
      preventConcurrentCalls: true, // Prevent multiple token refresh attempts
      maxRetries: 1, // Only try refreshing once
      
      // Handler will try to refresh the token
      handler: async (accountId) => {
        try {
          // Get the current token to extract refresh token
          const currentToken = await tokenService.get(accountId);
          
          // If no refresh token, we can't refresh
          if (!currentToken.refresh_token) {
            throw new Error('No refresh token available');
          }
          
          // Try to refresh the token
          await tokenService.refresh(currentToken.refresh_token, accountId);
          
          // Return empty object to retry with the same parameters
          // The ApiService will automatically get the new token on retry
          return {};
        } catch (error) {
          console.error('Token refresh failed:', error);
          throw error; // Re-throw to halt retry process
        }
      },
      
      // Called when max retries exceeded (refresh failed)
      onMaxRetriesExceeded: async (accountId, error) => {
        console.error('Authentication failed after refresh attempt', error);
        // You might want to trigger a sign out or auth UI here
        window.dispatchEvent(new CustomEvent('auth:required', { 
          detail: { accountId } 
        }));
      }
    },
    
    // Handle 403 Forbidden errors - typically for insufficient permissions
    403: {
      shouldRetry: false, // Don't retry these errors
      handler: async (accountId, response) => {
        console.warn('Permission denied:', response);
        // You could trigger a permissions UI here
        window.dispatchEvent(new CustomEvent('permission:required', { 
          detail: { accountId, resource: response.resource } 
        }));
        return null;
      }
    }
  },
  cacheTime: 30000
});

// Use the API service (with default account)
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