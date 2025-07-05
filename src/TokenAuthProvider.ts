import { AuthProvider, Token, OAuthToken } from './types';

export type TokenService = {
  get: (accountId?: string) => Promise<Token>;
  set: (token: Partial<Token>, accountId?: string) => Promise<void>;
  refresh?: (refreshToken: string, accountId?: string) => Promise<OAuthToken>;
};

export class TokenAuthProvider implements AuthProvider {
  private tokenService: TokenService;
  constructor(tokenService: TokenService) {
    this.tokenService = tokenService;
  }
  async getAuthHeaders(accountId?: string): Promise<Record<string, string>> {
    const token = await this.tokenService.get(accountId);
    if (!token?.access_token) return {};
    return { Authorization: `Bearer ${token.access_token}` };
  }
  public async refresh(accountId: string): Promise<void> {
    if (!this.tokenService.refresh) {
      throw new Error('Refresh not supported');
    }
    const token = await this.tokenService.get(accountId);
    if (!token?.refresh_token) {
      throw new Error('No refresh token available');
    }
    const newTokens = await this.tokenService.refresh(token.refresh_token, accountId);
    await this.tokenService.set(newTokens, accountId);
  }
}