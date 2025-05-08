import { AuthProvider, BasicAuthProviderOptions } from './types';

export class BasicAuthProvider implements AuthProvider {
  private username: string;
  private password: string;

  constructor(options: BasicAuthProviderOptions) {
    this.username = options.username;
    this.password = options.password;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const encoded = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }

  // No refresh for basic auth
} 