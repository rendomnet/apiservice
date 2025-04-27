import { AccountData } from './types';

/**
 * Manages account data and state
 */
export class AccountManager {
  private accounts: Record<string, AccountData> = {};

  /**
   * Update account data for a specific account
   */
  public updateAccountData(accountId: string, data: Partial<AccountData>): void {
    this.accounts[accountId] = { 
      ...this.accounts[accountId], 
      ...data 
    };
  }

  /**
   * Get account data for a specific account
   */
  public getAccountData(accountId: string): AccountData {
    return this.accounts[accountId] || {};
  }

  /**
   * Check if an account's last request failed
   */
  public didLastRequestFail(accountId: string): boolean {
    return !!this.accounts[accountId]?.lastFailed;
  }

  /**
   * Set account's last request as failed
   */
  public setLastRequestFailed(accountId: string, failed: boolean = true): void {
    this.updateAccountData(accountId, { lastFailed: failed });
  }

  /**
   * Update the last request time for an account
   */
  public updateLastRequestTime(accountId: string): void {
    this.updateAccountData(accountId, { lastRequestTime: Date.now() });
  }
} 