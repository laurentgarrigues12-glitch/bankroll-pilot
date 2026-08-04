import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ assertCanPerform: vi.fn(), database: { saveSettings: vi.fn(), saveOperation: vi.fn(), saveOperationsIfNew: vi.fn(), replaceBackupData: vi.fn(), resetBankrollData: vi.fn(), getBackupData: vi.fn() } }));
vi.mock('../access/accessService', () => ({ accessService: { assertCanPerform: mocks.assertCanPerform } }));
vi.mock('../../infrastructure/storage/bankrollDatabase', () => ({ bankrollDatabase: mocks.database }));

import { bankrollService } from './bankrollService';

describe('bankrollService access protection', () => {
  it.each([
    ['save-settings', () => bankrollService.saveSettings({ id: 'current', initialBankrollCents: 100, currency: 'EUR', startDate: '2026-01-01' })],
    ['create-operation', () => bankrollService.addOperation({ type: 'deposit', amountCents: 100, date: '2026-01-01', comment: '' })],
    ['import-winamax', () => bankrollService.importWinamaxOperations([])],
    ['restore-backup', () => bankrollService.restoreBackup({})],
    ['save-settings', () => bankrollService.resetBankroll()],
  ])('refuses %s before touching storage', async (action, operation) => {
    mocks.assertCanPerform.mockRejectedValueOnce(new Error('read-only'));
    await expect(operation()).rejects.toThrow('read-only');
    expect(mocks.assertCanPerform).toHaveBeenCalledWith(action);
  });

  it('keeps backup export available through its read-only path', async () => {
    mocks.database.getBackupData.mockResolvedValueOnce({ settings: null, operations: [], hands: [], imports: [] });
    await expect(bankrollService.createBackup()).resolves.toMatchObject({ format: 'bankroll-pilot-backup', version: 1 });
    expect(mocks.assertCanPerform).not.toHaveBeenCalledWith('export-backup');
  });
});
