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
  async refresh(refreshToken: string, accountId?: string): Promise<any> {
    if (!this.tokenService.refresh) throw new Error('Refresh not supported');
    const newToken = await this.tokenService.refresh(refreshToken, accountId);
    await this.tokenService.set({
      access_token: newToken.access_token,
      refresh_token: newToken.refresh_token || refreshToken,
    }, accountId);
    return newToken;
  }
} 