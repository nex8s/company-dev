export type BankAccountType = "operating" | "savings";
export type BankAccountStatus = "pending" | "active" | "frozen" | "closed" | "stub";

export type BankAccount = {
  accountId: string;
  companyId: string;
  legalEntityId: string;
  accountType: BankAccountType;
  status: BankAccountStatus;
  balanceUsd: number;
  currency: "USD";
  createdAt: Date;
};

export type OpenAccountInput = {
  companyId: string;
  legalEntityId: string;
  accountType: BankAccountType;
  idempotencyKey?: string;
};

export type VirtualCardStatus = "active" | "frozen" | "closed";

export type VirtualCard = {
  cardId: string;
  accountId: string;
  ownerAgentId: string;
  pan: string;
  last4: string;
  spendingLimitUsd: number;
  spentUsd: number;
  merchantCategoryFilters: string[];
  status: VirtualCardStatus;
  createdAt: Date;
};

export type IssueVirtualCardInput = {
  accountId: string;
  ownerAgentId: string;
  spendingLimitUsd: number;
  merchantCategoryFilters?: string[];
  idempotencyKey?: string;
};

export type TransactionStatus = "pending" | "settled" | "declined";

export type Transaction = {
  transactionId: string;
  cardId: string;
  accountId: string;
  merchant: string;
  merchantCategory: string;
  amountUsd: number;
  status: TransactionStatus;
  occurredAt: Date;
};

export interface BankProvider {
  openAccount(input: OpenAccountInput): Promise<BankAccount>;
  issueVirtualCard(input: IssueVirtualCardInput): Promise<VirtualCard>;
  listCards(accountId: string): Promise<VirtualCard[]>;
  listTransactions(accountId: string, since?: Date): Promise<Transaction[]>;
  freezeCard(cardId: string): Promise<void>;
}
