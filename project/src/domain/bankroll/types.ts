import type { ParsedWinamaxHand } from '../winamax/types';

export type FinancialOperationType = 'deposit' | 'withdrawal' | 'expense' | 'adjustment';
export interface BankrollSettings { id: 'current'; initialBankrollCents: number; currency: 'EUR'; startDate: string; }
export interface FinancialOperationMetadata { source?: string; sourceId?: string; }
export interface FinancialOperation { id: string; type: FinancialOperationType; amountCents: number; date: string; comment: string; createdAt: string; source?: string; sourceId?: string; metadata?: FinancialOperationMetadata; }
export interface BankrollSnapshot { currentCents: number; pokerTodayCents: number; pokerMonthCents: number; depositMonthCents: number; withdrawalMonthCents: number; pokerTotalCents: number; }
export type StoredHand = ParsedWinamaxHand & { netResultCents: number; importedAt: string; };
