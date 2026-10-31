import { calculateBankroll } from '../../domain/bankroll/calculateBankroll';
import { toCalendarDate } from '../../domain/bankroll/calendarDate';
import type { BankrollSettings, FinancialOperation, FinancialOperationType, BankrollSnapshot, StoredHand } from '../../domain/bankroll/types';
import { bankrollDatabase } from '../../infrastructure/storage/bankrollDatabase';
import { parseBankrollBackup, type BankrollBackup } from '../../domain/bankroll/backup';
import { accessService } from '../access/accessService';
import { isWinamaxImportedOperation, normalizeWinamaxOperation, winamaxSourceIdFor } from '../../domain/bankroll/winamaxOperation';

export interface DashboardModel { settings?: BankrollSettings; snapshot?: BankrollSnapshot; hands: StoredHand[]; operations: FinancialOperation[]; }
export interface BankrollChartPoint { index: number; date: string; cumulativeResult: number; dailyResult: number; }
export interface WinamaxOperationImport { type: FinancialOperationType; amountCents: number; date: string; comment: string; importKey: string; }
export interface WinamaxOperationInspection { id: string; type: FinancialOperationType; amountCents: number; date: string; source?: string; sourceId?: string; description: string; metadata?: FinancialOperation['metadata']; }

const createId = (): string => crypto.randomUUID();
export const bankrollService = {
  load: async (): Promise<DashboardModel> => { const [settings, hands, operations] = await Promise.all([bankrollDatabase.getSettings(), bankrollDatabase.getHands(), bankrollDatabase.getOperations()]); return { settings, hands, operations, snapshot: settings === undefined ? undefined : calculateBankroll(settings, hands, operations) }; },
  saveSettings: async (settings: BankrollSettings): Promise<void> => { await accessService.assertCanPerform('save-settings'); await bankrollDatabase.saveSettings(settings); },
  createBackup: async (): Promise<BankrollBackup> => ({ format: 'bankroll-pilot-backup', version: 1, exportedAt: new Date().toISOString(), data: await bankrollDatabase.getBackupData() }),
  restoreBackup: async (candidate: unknown): Promise<BankrollBackup> => { await accessService.assertCanPerform('restore-backup'); const backup = parseBankrollBackup(candidate); await bankrollDatabase.replaceBackupData(backup.data); return backup; },
  resetBankroll: async (): Promise<void> => {
    await accessService.assertCanPerform('save-settings');
    await bankrollDatabase.resetBankrollData();
  },
  addOperation: async (input: Omit<FinancialOperation, 'id' | 'createdAt'>): Promise<void> => { await accessService.assertCanPerform('create-operation'); await bankrollDatabase.saveOperation({ ...input, id: createId(), createdAt: new Date().toISOString() }); },
  importWinamaxOperations: async (imports: WinamaxOperationImport[]): Promise<{ importedCount: number; duplicateCount: number }> => {
    await accessService.assertCanPerform('import-winamax');
    const createdAt = new Date().toISOString();
    const operations = imports.map((item) => ({ id: `winamax:${item.importKey}`, type: item.type, amountCents: item.amountCents, date: item.date, comment: item.comment, createdAt, source: 'winamax', sourceId: item.importKey }));
    const existing = await bankrollDatabase.getOperations();
    const existingSourceIds = new Set(existing.map(winamaxSourceIdFor).filter((value): value is string => value !== undefined));
    const legacyMatches = existing.filter((operation) => {
      const sourceId = winamaxSourceIdFor(operation);
      return sourceId !== undefined && operations.some((candidate) => candidate.sourceId === sourceId);
    });
    await bankrollDatabase.updateOperations(legacyMatches.map(normalizeWinamaxOperation));
    const candidates = operations.filter((operation) => !existingSourceIds.has(operation.sourceId));
    const result = await bankrollDatabase.saveOperationsIfNew(candidates);
    return { importedCount: result.savedCount, duplicateCount: result.duplicateCount + operations.length - candidates.length };
  },
  importWinamaxFolderOperations: async (imports: WinamaxOperationImport[], sourceFingerprintsByImportKey: Record<string, string[]>): Promise<{ importedCount: number; duplicateCount: number }> => {
    await accessService.assertCanPerform('import-winamax');
    const createdAt = new Date().toISOString();
    const operations = imports.map((item) => ({ id: `winamax:${item.importKey}`, type: item.type, amountCents: item.amountCents, date: item.date, comment: item.comment, createdAt, source: 'winamax' as const, sourceId: item.importKey }));
    const result = await bankrollDatabase.saveWinamaxFolderImport(operations, sourceFingerprintsByImportKey);
    return { importedCount: result.savedCount, duplicateCount: result.duplicateCount };
  },
  inspectWinamaxOperations: async (): Promise<WinamaxOperationInspection[]> => (await bankrollDatabase.getOperations()).filter(isWinamaxImportedOperation).map((operation) => ({ id: operation.id, type: operation.type, amountCents: operation.amountCents, date: operation.date, source: operation.source, sourceId: operation.sourceId ?? operation.metadata?.sourceId, description: operation.comment, metadata: operation.metadata })),
  repairLegacyWinamaxOperations: async (): Promise<{ repairedCount: number }> => {
    const operations = await bankrollDatabase.getOperations();
    const repairs = operations.filter(isWinamaxImportedOperation).flatMap((original) => {
      const normalized = normalizeWinamaxOperation(original);
      return normalized.source !== original.source || normalized.sourceId !== original.sourceId ? [normalized] : [];
    });
    await bankrollDatabase.updateOperations(repairs);
    return { repairedCount: repairs.length };
  },
  deleteOperation: async (id: string): Promise<void> => bankrollDatabase.deleteOperation(id),
  createOperation: (type: FinancialOperationType, amountCents: number, date: string, comment: string): Omit<FinancialOperation, 'id' | 'createdAt'> => ({ type, amountCents, date, comment: comment.trim() }),
  createChartSeries: (
    settings: BankrollSettings,
    hands: StoredHand[],
    operations: FinancialOperation[],
  ): BankrollChartPoint[] => {
    const events: {
      date: string;
      amountCents: number;
      order: string;
    }[] = [];

    hands.forEach((hand) => {
      events.push({
        date: toCalendarDate(hand.playedAt),
        amountCents: hand.netResultCents,
        order: hand.playedAt,
      });
    });

    operations
      .filter(
        (operation) =>
          (operation.type === 'adjustment' &&
            isWinamaxImportedOperation(operation)) ||
          operation.type === 'correction',
      )
      .forEach((operation) => {
        events.push({
          date: toCalendarDate(operation.date),
          amountCents: operation.amountCents,
          order: operation.createdAt,
        });
      });

    events.sort((left, right) => {
      const dateOrder = left.date.localeCompare(right.date);

      if (dateOrder !== 0) return dateOrder;

      return left.order.localeCompare(right.order);
    });

    let cumulativeCents = 0;

    const series: BankrollChartPoint[] = [
      {
        index: 0,
        date: settings.startDate,
        cumulativeResult: 0,
        dailyResult: 0,
      },
    ];

    events.forEach((event) => {
      cumulativeCents += event.amountCents;

      series.push({
        index: series.length,
        date: event.date,
        cumulativeResult: cumulativeCents / 100,
        dailyResult: event.amountCents / 100,
      });
    });

    return series;
  },
};
