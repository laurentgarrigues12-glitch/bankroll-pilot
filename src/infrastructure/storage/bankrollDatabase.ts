import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb';
import type { FinancialOperation, BankrollSettings, StoredHand } from '../../domain/bankroll/types';
import type { BackupData, ImportRecord } from '../../domain/bankroll/backup';
import type { WinamaxFolderConfiguration } from '../filesystem/fileSystemAccessSupport';
import type { WinamaxScannedFileRecord } from '../../domain/winamax/winamaxScannedFile';

export interface BankrollDbSchema extends DBSchema {
  settings: { key: string; value: BankrollSettings };
  importedHands: { key: string; value: StoredHand; indexes: { 'by-played-at': string } };
  imports: { key: string; value: ImportRecord };
  financialOperations: { key: string; value: FinancialOperation; indexes: { 'by-date': string } };
  winamaxFolder: { key: string; value: WinamaxFolderConfiguration };
  winamaxScannedFiles: { key: string; value: WinamaxScannedFileRecord };
}

type WinamaxImportStores = 'financialOperations' | 'winamaxScannedFiles';
export type BankrollTransactionFactory = (database: IDBPDatabase<BankrollDbSchema>) => IDBPTransaction<BankrollDbSchema, WinamaxImportStores[], 'readwrite'>;
export const createWinamaxImportTransaction: BankrollTransactionFactory = (database) => database.transaction(['financialOperations', 'winamaxScannedFiles'], 'readwrite');

export const openBankrollDatabase = (name = 'bankroll-pilot') => openDB<BankrollDbSchema>(name, 3, { upgrade(database) { if (!database.objectStoreNames.contains('settings')) database.createObjectStore('settings'); if (!database.objectStoreNames.contains('importedHands')) database.createObjectStore('importedHands', { keyPath: 'handId' }).createIndex('by-played-at', 'playedAt'); if (!database.objectStoreNames.contains('imports')) database.createObjectStore('imports', { keyPath: 'id' }); if (!database.objectStoreNames.contains('financialOperations')) database.createObjectStore('financialOperations', { keyPath: 'id' }).createIndex('by-date', 'date'); if (!database.objectStoreNames.contains('winamaxFolder')) database.createObjectStore('winamaxFolder'); if (!database.objectStoreNames.contains('winamaxScannedFiles')) database.createObjectStore('winamaxScannedFiles', { keyPath: 'fingerprint' }); } });
const db = () => openBankrollDatabase();
export const bankrollDatabase = {
  getSettings: async (): Promise<BankrollSettings | undefined> => (await db()).get('settings', 'current'),
  saveSettings: async (settings: BankrollSettings): Promise<void> => { await (await db()).put('settings', settings, 'current'); },
  getWinamaxFolderConfiguration: async (): Promise<WinamaxFolderConfiguration | undefined> => (await db()).get('winamaxFolder', 'current'),
  saveWinamaxFolderConfiguration: async (configuration: WinamaxFolderConfiguration): Promise<void> => { await (await db()).put('winamaxFolder', configuration, 'current'); },
  deleteWinamaxFolderConfiguration: async (): Promise<void> => { await (await db()).delete('winamaxFolder', 'current'); },
  getWinamaxScannedFile: async (fingerprint: string): Promise<WinamaxScannedFileRecord | undefined> => (await db()).get('winamaxScannedFiles', fingerprint),
  getWinamaxScannedFiles: async (): Promise<WinamaxScannedFileRecord[]> => (await db()).getAll('winamaxScannedFiles'),
  saveWinamaxScannedFiles: async (records: WinamaxScannedFileRecord[]): Promise<void> => { const database = await db(); const transaction = database.transaction('winamaxScannedFiles', 'readwrite'); for (const record of records) await transaction.store.put(record); await transaction.done; },
  getHands: async (): Promise<StoredHand[]> => (await (await db()).getAll('importedHands')),
  getImports: async (): Promise<ImportRecord[]> => (await (await db()).getAll('imports')),
  saveHands: async (hands: StoredHand[]): Promise<number> => { const database = await db(); const transaction = database.transaction('importedHands', 'readwrite'); let count = 0; for (const hand of hands) { if (await transaction.store.get(hand.handId) === undefined) { await transaction.store.put(hand); count += 1; } } await transaction.done; return count; },
  saveImport: async (record: { id: string; importedAt: string; handCount: number; netResultCents: number }): Promise<void> => { await (await db()).put('imports', record); },
  getOperations: async (): Promise<FinancialOperation[]> => (await (await db()).getAll('financialOperations')).sort((a, b) => b.date.localeCompare(a.date)),
  saveOperation: async (operation: FinancialOperation): Promise<void> => { await (await db()).put('financialOperations', operation); },
  updateOperations: async (operations: FinancialOperation[]): Promise<void> => {
    if (operations.length === 0) return;
    const database = await db();
    const transaction = database.transaction('financialOperations', 'readwrite');
    for (const operation of operations) await transaction.store.put(operation);
    await transaction.done;
  },
  saveOperationsIfNew: async (operations: FinancialOperation[]): Promise<{ savedCount: number; duplicateCount: number }> => {
    const database = await db();
    const transaction = database.transaction('financialOperations', 'readwrite');
    const pending: FinancialOperation[] = [];
    const ids = new Set<string>();
    let duplicateCount = 0;
    for (const operation of operations) {
      if (ids.has(operation.id) || await transaction.store.get(operation.id) !== undefined) { duplicateCount += 1; continue; }
      ids.add(operation.id);
      pending.push(operation);
    }
    for (const operation of pending) await transaction.store.put(operation);
    await transaction.done;
    return { savedCount: pending.length, duplicateCount };
  },
  saveWinamaxFolderImport: async (operations: FinancialOperation[], sourceFingerprintsByImportKey: Record<string, string[]>, transactionFactory: BankrollTransactionFactory = createWinamaxImportTransaction): Promise<{ savedCount: number; duplicateCount: number }> => {
    const database = await db();
    const transaction = transactionFactory(database);
    const operationsStore = transaction.objectStore('financialOperations');
    const scannedStore = transaction.objectStore('winamaxScannedFiles');
    let savedCount = 0;
    let duplicateCount = 0;
    const processed = new Set<string>();
    for (const operation of operations) {
      const duplicate = processed.has(operation.id) || await operationsStore.get(operation.id) !== undefined;
      processed.add(operation.id);
      if (duplicate) duplicateCount += 1;
      else { await operationsStore.put(operation); savedCount += 1; }
      const status = duplicate ? 'duplicate' : 'imported';
      for (const fingerprint of sourceFingerprintsByImportKey[operation.sourceId ?? ''] ?? []) {
        const record = await scannedStore.get(fingerprint);
        if (record !== undefined) await scannedStore.put({ ...record, status, lastSeenAt: new Date().toISOString() });
      }
    }
    await transaction.done;
    return { savedCount, duplicateCount };
  },
  deleteOperation: async (id: string): Promise<void> => { await (await db()).delete('financialOperations', id); },
  resetBankrollData: async (): Promise<void> => {
    const database = await db();
    const transaction = database.transaction(['settings', 'financialOperations', 'importedHands', 'imports', 'winamaxScannedFiles'], 'readwrite');
    await Promise.all([
      transaction.objectStore('settings').clear(),
      transaction.objectStore('financialOperations').clear(),
      transaction.objectStore('importedHands').clear(),
      transaction.objectStore('imports').clear(),
      transaction.objectStore('winamaxScannedFiles').clear(),
    ]);
    await transaction.done;
  },
  getBackupData: async (): Promise<BackupData> => { const database = await db(); const [settings, operations, hands, imports] = await Promise.all([database.get('settings', 'current'), database.getAll('financialOperations'), database.getAll('importedHands'), database.getAll('imports')]); return { settings: settings ?? null, operations, hands, imports }; },
  replaceBackupData: async (data: BackupData): Promise<void> => {
    const database = await db();
    const transaction = database.transaction(['settings', 'financialOperations', 'importedHands', 'imports'], 'readwrite');
    const settingsStore = transaction.objectStore('settings'); const operationsStore = transaction.objectStore('financialOperations'); const handsStore = transaction.objectStore('importedHands'); const importsStore = transaction.objectStore('imports');
    await Promise.all([settingsStore.clear(), operationsStore.clear(), handsStore.clear(), importsStore.clear()]);
    if (data.settings !== null) await settingsStore.put(data.settings, 'current');
    for (const operation of data.operations) await operationsStore.put(operation);
    for (const hand of data.hands) await handsStore.put(hand);
    for (const record of data.imports) await importsStore.put(record);
    await transaction.done;
  },
};
