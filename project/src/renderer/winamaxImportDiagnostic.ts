import type { FinancialOperationType } from '../domain/bankroll/types';

export interface WinamaxDiagnosticOperation {
  id: string;
  type: FinancialOperationType;
  amountCents: number;
  date: string;
  source: 'winamax';
  sourceId: string;
}

export interface WinamaxImportDiagnostic {
  previewEntriesCount: number;
  validEntriesCount: number;
  generatedOperationsCount: number;
  generatedOperations: WinamaxDiagnosticOperation[];
  importedCount?: number;
  duplicateCount?: number;
  error?: string;
  indexedDbOperationsCount?: number;
  winamaxOperationsCount?: number;
  dashboard?: { currentCents: number; pokerTodayCents: number; pokerMonthCents: number; pokerTotalCents: number; chartPointsCount: number };
}
