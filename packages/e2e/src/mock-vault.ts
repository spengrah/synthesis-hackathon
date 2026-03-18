/**
 * Mock vault — in-memory tracker for ETH deposits/withdrawals.
 * Simulates the Vault contract behavior without a real deployment.
 * Real Vault.sol replaces this later.
 */

export interface WithdrawalRecord {
  zone: string;
  amount: bigint;
  timestamp: number;
}

export class MockVault {
  private _balance: bigint = 0n;
  private _withdrawals: WithdrawalRecord[] = [];
  private _maxAmount: bigint;

  /**
   * @param maxAmount The max withdrawal amount (the `n` from negotiation)
   * @param initialBalance Pre-fund the vault
   */
  constructor(maxAmount: bigint, initialBalance: bigint = 0n) {
    this._maxAmount = maxAmount;
    this._balance = initialBalance;
  }

  get balance(): bigint {
    return this._balance;
  }

  get maxAmount(): bigint {
    return this._maxAmount;
  }

  deposit(amount: bigint): void {
    this._balance += amount;
  }

  /**
   * Attempt a withdrawal. Enforces the constraint (amount <= maxAmount).
   * Returns true if successful, false if constraint violated.
   */
  withdraw(zone: string, amount: bigint): { success: boolean; error?: string } {
    if (amount > this._maxAmount) {
      return { success: false, error: `ExceedsPermittedAmount: requested ${amount}, max ${this._maxAmount}` };
    }
    if (amount > this._balance) {
      return { success: false, error: `InsufficientBalance: requested ${amount}, balance ${this._balance}` };
    }

    this._balance -= amount;
    this._withdrawals.push({ zone, amount, timestamp: Date.now() });
    console.log(`[mock-vault] ${zone} withdrew ${amount} wei (balance: ${this._balance})`);
    return { success: true };
  }

  getWithdrawals(): WithdrawalRecord[] {
    return [...this._withdrawals];
  }

  getWithdrawalsByZone(zone: string): WithdrawalRecord[] {
    return this._withdrawals.filter((w) => w.zone.toLowerCase() === zone.toLowerCase());
  }
}
