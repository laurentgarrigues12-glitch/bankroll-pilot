import { describe, expect, it } from 'vitest';
import { backupFileName, parseBankrollBackup } from './backup';

const backup = { format: 'bankroll-pilot-backup', version: 1, exportedAt: '2026-07-30T10:00:00.000Z', data: { settings: { id: 'current', initialBankrollCents: 10000, currency: 'EUR', startDate: '2026-07-01' }, operations: [{ id: 'winamax:key', type: 'deposit', amountCents: 1250, date: '2026-07-20', comment: 'Source', createdAt: '2026-07-20T00:00:00.000Z' }], hands: [], imports: [] } } as const;

describe('bankroll backup', () => {
  it('validates a versioned backup and produces an explicit file name', () => {
    expect(parseBankrollBackup(backup)).toMatchObject({ format: 'bankroll-pilot-backup', data: { operations: [{ amountCents: 1250 }] } });
    expect(backupFileName(new Date('2026-07-30T10:00:00.000Z'))).toBe('bankroll-pilot-backup-2026-07-30.json');
  });
  it.each([{ ...backup, format: 'other' }, { ...backup, version: 2 }, { ...backup, data: { ...backup.data, operations: [{ ...backup.data.operations[0], amountCents: 12.5 }] } }])('rejects an invalid backup', (candidate) => { expect(() => parseBankrollBackup(candidate)).toThrow(); });
});
