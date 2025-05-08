import { AuthProvider, ApiKeyAuthProviderOptions } from './types';

export class ApiKeyAuthProvider implements AuthProvider {
  private apiKey: string;
  private headerName?: string;
  private queryParamName?: string;

  constructor(options: ApiKeyAuthProviderOptions) {
    this.apiKey = options.apiKey;
    this.headerName = options.headerName;
    this.queryParamName = options.queryParamName;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    if (this.headerName) {
      return { [this.headerName]: this.apiKey };
    }
    // If using query param, return empty headers (handled elsewhere)
    return {};
  }

  // For API key, refresh is not supported
} 